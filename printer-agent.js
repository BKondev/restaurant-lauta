const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');

const { printOrder, findNetworkPrinters, getLocalIP } = require('./printer-service');

function setupFileLogging() {
    const logFile = env('AGENT_LOG_FILE', '').trim();
    if (!logFile) return;

    const logPath = path.isAbsolute(logFile) ? logFile : path.join(process.cwd(), logFile);
    try {
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
    } catch {
        // ignore
    }

    const stream = fs.createWriteStream(logPath, { flags: 'a' });
    const original = {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
    };

    function format(level, args) {
        const msg = args.map(a => {
            if (a instanceof Error) return a.stack || a.message;
            if (typeof a === 'string') return a;
            try { return JSON.stringify(a); } catch { return String(a); }
        }).join(' ');
        return `[${new Date().toISOString()}] [${level}] ${msg}\n`;
    }

    function write(level, args) {
        try {
            stream.write(format(level, args));
        } catch {
            // ignore
        }
    }

    console.log = (...args) => { original.log(...args); write('INFO', args); };
    console.warn = (...args) => { original.warn(...args); write('WARN', args); };
    console.error = (...args) => { original.error(...args); write('ERROR', args); };

    process.on('exit', () => {
        try { stream.end(); } catch { /* ignore */ }
    });

    process.on('uncaughtException', (err) => {
        write('FATAL', [err]);
        try {
            stream.end(() => process.exit(1));
        } catch {
            process.exit(1);
        }
    });

    process.on('unhandledRejection', (reason) => {
        write('FATAL', [reason]);
        try {
            stream.end(() => process.exit(1));
        } catch {
            process.exit(1);
        }
    });

    original.log(`[AGENT] Logging to file: ${logPath}`);
}

function env(name, fallback = '') {
    const v = process.env[name];
    return (v === undefined || v === null) ? fallback : String(v);
}

setupFileLogging();

function parseBool(raw, fallback = false) {
    if (raw === undefined || raw === null || raw === '') return fallback;
    const s = String(raw).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
    return fallback;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function requestJson(method, urlString, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlString);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;

        const req = lib.request({
            method,
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            headers: {
                'Accept': 'application/json',
                ...headers,
            }
        }, (res) => {
            let raw = '';
            res.on('data', chunk => { raw += chunk; });
            res.on('end', () => {
                const status = res.statusCode || 0;
                let json = null;
                try {
                    json = raw ? JSON.parse(raw) : null;
                } catch (e) {
                    // ignore
                }
                resolve({ status, json, raw });
            });
        });

        req.on('error', reject);

        if (body) {
            const payload = (typeof body === 'string') ? body : JSON.stringify(body);
            req.setHeader('Content-Type', 'application/json');
            req.write(payload);
        }

        req.end();
    });
}

function loadState(stateFile) {
    try {
        if (!fs.existsSync(stateFile)) return { printed: {} };
        const raw = fs.readFileSync(stateFile, 'utf8');
        const json = JSON.parse(raw);
        return (json && typeof json === 'object') ? json : { printed: {} };
    } catch {
        return { printed: {} };
    }
}

function saveState(stateFile, state) {
    try {
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
        console.error('[STATE] Failed to write state file:', e.message);
    }
}

function normalizePrinterConfig(input) {
    const src = (input && typeof input === 'object') ? input : {};
    const enabled = src.enabled !== undefined ? !!src.enabled : false;
    const ip = (src.ip || src.host || src.printerIp || '').toString().trim();
    const port = Math.max(1, Math.min(65535, parseInt(src.port || 9100, 10) || 9100));
    const autoPrintOnApproved = src.autoPrintOnApproved !== undefined ? !!src.autoPrintOnApproved : true;
    const printPickup = src.printPickup !== undefined ? !!src.printPickup : true;
    const allowAutoDiscovery = src.allowAutoDiscovery !== undefined ? !!src.allowAutoDiscovery : false;

    return { enabled, ip, port, autoPrintOnApproved, printPickup, allowAutoDiscovery };
}

function getSubnetHint() {
    const ip = getLocalIP && typeof getLocalIP === 'function' ? getLocalIP() : '';
    const parts = (ip || '').split('.');
    if (parts.length === 4 && parts[0] && parts[1] && parts[2]) {
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
    return '';
}

function checkTcpPort(ip, port, timeout = 350) {
    return new Promise((resolve) => {
        if (!ip || !port) return resolve(false);
        const socket = new net.Socket();
        let resolved = false;

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            if (resolved) return;
            resolved = true;
            try { socket.destroy(); } catch {}
            resolve(true);
        });

        socket.on('timeout', () => {
            if (resolved) return;
            resolved = true;
            try { socket.destroy(); } catch {}
            resolve(false);
        });

        socket.on('error', () => {
            if (resolved) return;
            resolved = true;
            try { socket.destroy(); } catch {}
            resolve(false);
        });

        try {
            socket.connect(port, ip);
        } catch {
            try { socket.destroy(); } catch {}
            resolve(false);
        }
    });
}

async function fetchRestaurantProfile(apiBaseUrl, apiKey) {
    const url = `${apiBaseUrl}/restaurants/me`;
    const r = await requestJson('GET', url, { 'x-api-key': apiKey });
    if (r.status !== 200) {
        throw new Error(`Failed to load restaurant profile (${r.status})`);
    }
    return r.json || {};
}

async function fetchApprovedOrders(apiBaseUrl, apiKey) {
    const url = `${apiBaseUrl}/orders?status=approved`;
    const r = await requestJson('GET', url, { 'x-api-key': apiKey });
    if (r.status !== 200) {
        throw new Error(`Failed to load orders (${r.status})`);
    }
    return Array.isArray(r.json) ? r.json : [];
}

async function fetchAgentCommands(apiBaseUrl, apiKey) {
    const url = `${apiBaseUrl}/agent/commands`;
    const r = await requestJson('GET', url, { 'x-api-key': apiKey });
    if (r.status !== 200) {
        console.warn(`[AGENT] Failed to load commands (${r.status})`, r.json || r.raw);
        return [];
    }
    return Array.isArray(r.json?.commands) ? r.json.commands : [];
}

async function completeAgentCommand(apiBaseUrl, apiKey, commandId, payload) {
    const url = `${apiBaseUrl}/agent/commands/${encodeURIComponent(commandId)}/complete`;
    const r = await requestJson('POST', url, { 'x-api-key': apiKey }, payload);
    if (r.status !== 200) {
        console.warn(`[AGENT] Failed to complete command ${commandId} (${r.status})`, r.json || r.raw);
        return false;
    }
    return true;
}

async function handleAgentCommands(apiBaseUrl, apiKey, envOverride) {
    const commands = await fetchAgentCommands(apiBaseUrl, apiKey);
    if (!commands || commands.length === 0) return;

    for (const cmd of commands) {
        const id = (cmd?.id || '').toString();
        const type = (cmd?.type || '').toString();
        const payload = (cmd?.payload && typeof cmd.payload === 'object') ? cmd.payload : {};

        if (!id || !type) continue;

        try {
            if (type === 'printer.scan') {
                const subnet = (payload.subnet || envOverride?.subnet || getSubnetHint() || '').toString().trim();
                const port = Number.isFinite(Number(payload.port)) ? Number(payload.port) : 9100;
                const timeout = Number.isFinite(Number(payload.timeout)) ? Number(payload.timeout) : 350;
                const concurrency = Number.isFinite(Number(payload.concurrency)) ? Number(payload.concurrency) : 32;

                if (!subnet) {
                    await completeAgentCommand(apiBaseUrl, apiKey, id, {
                        success: false,
                        error: 'Missing subnet. Set AGENT_SUBNET or provide subnet in request.'
                    });
                    continue;
                }

                const printers = await findNetworkPrinters({ subnet, port, timeout, concurrency });
                await completeAgentCommand(apiBaseUrl, apiKey, id, {
                    success: true,
                    result: {
                        printers: Array.isArray(printers) ? printers : [],
                        subnetUsed: subnet,
                        portUsed: port,
                        timeout,
                        concurrency
                    }
                });
                continue;
            }

            if (type === 'printer.test') {
                const ip = (payload.ip || '').toString().trim();
                const port = Number.isFinite(Number(payload.port)) ? Number(payload.port) : 9100;
                if (!ip) {
                    await completeAgentCommand(apiBaseUrl, apiKey, id, { success: false, error: 'Missing ip' });
                    continue;
                }

                const ok = await checkTcpPort(ip, port, 800);
                await completeAgentCommand(apiBaseUrl, apiKey, id, ok
                    ? { success: true, result: { ip, port, tested: ip } }
                    : { success: false, error: `Cannot connect to ${ip}:${port}`, result: { ip, port, tested: ip } }
                );
                continue;
            }

            await completeAgentCommand(apiBaseUrl, apiKey, id, { success: false, error: `Unknown command type: ${type}` });
        } catch (e) {
            await completeAgentCommand(apiBaseUrl, apiKey, id, { success: false, error: e?.message || 'Command failed' });
        }
    }
}

async function markOrderPrinted(apiBaseUrl, apiKey, orderId, printerTarget) {
    const url = `${apiBaseUrl}/orders/${encodeURIComponent(orderId)}/printed`;
    const body = {
        printedAt: new Date().toISOString(),
        printerIp: printerTarget?.ip || '',
        printerPort: printerTarget?.port || 9100,
        source: 'printer-agent'
    };
    const r = await requestJson('POST', url, { 'x-api-key': apiKey }, body);
    if (r.status !== 200) {
        console.warn(`[MARK] Failed to mark printed for ${orderId} (${r.status})`, r.json || r.raw);
        return false;
    }
    return !!r.json?.success;
}

async function clearOrderReprint(apiBaseUrl, apiKey, orderId) {
    const url = `${apiBaseUrl}/orders/${encodeURIComponent(orderId)}/clear-reprint`;
    const r = await requestJson('POST', url, { 'x-api-key': apiKey }, {});
    if (r.status !== 200) {
        console.warn(`[REPRINT] Failed to clear reprint for ${orderId} (${r.status})`, r.json || r.raw);
        return false;
    }
    return !!r.json?.success;
}

async function resolvePrinterTarget(printerCfg, envOverride, state) {
    const overrideIp = (envOverride.ip || '').toString().trim();
    const overridePort = envOverride.port;
    if (overrideIp) {
        return { ip: overrideIp, port: overridePort || 9100, resolvedBy: 'env' };
    }

    // If we discovered a printer before, reuse it (avoid scanning every poll)
    const cached = state && state.lastPrinter && typeof state.lastPrinter === 'object' ? state.lastPrinter : null;
    if (cached && cached.ip && cached.port) {
        const ok = await checkTcpPort(String(cached.ip), Number(cached.port) || 9100, 250);
        if (ok) {
            return { ip: String(cached.ip), port: Number(cached.port) || 9100, resolvedBy: 'cache' };
        }
    }

    // Prefer explicit printer IP saved on the VPS profile
    if (printerCfg.ip) {
        const ok = await checkTcpPort(String(printerCfg.ip), Number(printerCfg.port) || 9100, 250);
        if (ok) {
            return { ip: printerCfg.ip, port: printerCfg.port || 9100, resolvedBy: 'profile' };
        }

        // Saved IP exists but is unreachable (common when DHCP changes). If allowed, try discovery.
        if (!printerCfg.allowAutoDiscovery) {
            return null;
        }
    }

    if (!printerCfg.allowAutoDiscovery) return null;

    const subnet = envOverride.subnet || getSubnetHint();
    const port = printerCfg.port || 9100;

    if (!subnet) return null;

    const printers = await findNetworkPrinters({ subnet, port, timeout: 350, concurrency: 32 });
    if (!printers || printers.length === 0) return null;

    const discovered = { ip: printers[0].ip, port: printers[0].port || port };
    if (state && typeof state === 'object') {
        state.lastPrinter = { ...discovered, discoveredAt: new Date().toISOString(), subnet };
    }

    return { ...discovered, resolvedBy: 'auto-discovery' };
}

async function run() {
    const apiBaseUrl = env('AGENT_API_BASE_URL', 'https://bojole.bg/resturant-website/api').replace(/\/+$/, '');
    const apiKey = env('AGENT_API_KEY', '').trim();
    if (!apiKey) {
        console.error('Missing AGENT_API_KEY');
        process.exit(1);
    }

    const pollIntervalMs = Math.max(1500, parseInt(env('AGENT_POLL_INTERVAL_MS', '5000'), 10) || 5000);
    const stateFile = env('AGENT_STATE_FILE', path.join(__dirname, 'printer-agent-state.json'));
    const dryRun = parseBool(env('AGENT_DRY_RUN', ''), false);

    const envPrinterIp = env('AGENT_PRINTER_IP', '').trim();
    const envPrinterPort = parseInt(env('AGENT_PRINTER_PORT', ''), 10) || 0;
    const envSubnet = env('AGENT_SUBNET', '').trim();

    const state = loadState(stateFile);
    state.printed = (state.printed && typeof state.printed === 'object') ? state.printed : {};
    state.lastPrinter = (state.lastPrinter && typeof state.lastPrinter === 'object') ? state.lastPrinter : null;

    console.log('[AGENT] Starting printer agent');
    console.log('[AGENT] API:', apiBaseUrl);
    console.log('[AGENT] Poll:', pollIntervalMs, 'ms');
    console.log('[AGENT] State file:', stateFile);
    console.log('[AGENT] Dry run:', dryRun ? 'YES' : 'NO');

    while (true) {
        try {
            await handleAgentCommands(apiBaseUrl, apiKey, { subnet: envSubnet });

            const profile = await fetchRestaurantProfile(apiBaseUrl, apiKey);
            const printerCfg = normalizePrinterConfig(profile.printer);

            if (!printerCfg.enabled || !printerCfg.autoPrintOnApproved) {
                await sleep(pollIntervalMs);
                continue;
            }

            const printerTarget = await resolvePrinterTarget(printerCfg, { ip: envPrinterIp, port: envPrinterPort || printerCfg.port || 9100, subnet: envSubnet }, state);
            if (!printerTarget) {
                console.warn('[AGENT] No printer target configured/discovered.');
                await sleep(pollIntervalMs);
                continue;
            }

            // Persist updated discovery cache if it changed
            saveState(stateFile, state);

            const orders = await fetchApprovedOrders(apiBaseUrl, apiKey);
            const candidates = orders
                .filter(o => o && (o.forceReprint === true ? true : !(o.printerPrintedAt ? true : false)))
                .filter(o => {
                    const orderId = String(o?.id || '');
                    if (!orderId) return false;
                    return o.forceReprint === true ? true : !state.printed[orderId];
                })
                .filter(o => {
                    const method = (o.deliveryMethod || o.deliveryType || '').toString();
                    const isPickup = method === 'pickup';
                    return !isPickup || printerCfg.printPickup;
                })
                .sort((a, b) => new Date(a.timestamp || a.createdAt || 0) - new Date(b.timestamp || b.createdAt || 0));

            for (const order of candidates) {
                const orderId = String(order.id || '');
                if (!orderId) continue;

                console.log(`[AGENT] Printing order ${orderId} -> ${printerTarget.ip}:${printerTarget.port} (${printerTarget.resolvedBy})`);

                if (!dryRun) {
                    let r = await printOrder(order, { ip: printerTarget.ip, port: printerTarget.port });
                    if (!r || !r.success) {
                        console.error('[AGENT] Print failed:', r?.error || 'unknown');

                        // If we used a saved IP and it failed, try one discovery refresh and retry once.
                        if ((printerTarget.resolvedBy === 'profile' || printerTarget.resolvedBy === 'cache') && printerCfg.allowAutoDiscovery) {
                            console.warn('[AGENT] Retrying after auto-discovery...');
                            const refreshed = await resolvePrinterTarget(
                                { ...printerCfg, ip: '' },
                                { ip: envPrinterIp, port: envPrinterPort || printerCfg.port || 9100, subnet: envSubnet },
                                state
                            );
                            if (refreshed) {
                                saveState(stateFile, state);
                                r = await printOrder(order, { ip: refreshed.ip, port: refreshed.port });
                                if (!r || !r.success) {
                                    console.error('[AGENT] Retry print failed:', r?.error || 'unknown');
                                    continue;
                                }
                            } else {
                                continue;
                            }
                        } else {
                            continue;
                        }
                    }
                }

                const marked = await markOrderPrinted(apiBaseUrl, apiKey, orderId, printerTarget);
                if (marked) {
                    state.printed[orderId] = new Date().toISOString();
                    saveState(stateFile, state);

                    if (order.forceReprint === true) {
                        await clearOrderReprint(apiBaseUrl, apiKey, orderId);
                    }
                }
            }
        } catch (e) {
            console.error('[AGENT] Loop error:', e.message);
        }

        await sleep(pollIntervalMs);
    }
}

if (require.main === module) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
