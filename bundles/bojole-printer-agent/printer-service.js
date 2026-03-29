const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const iconv = require('iconv-lite');

const RECEIPT_WIDTH = 48;

function escposBigSize() {
    return Buffer.from([0x1B, 0x21, 0x30]);
}

function escposNormalSize() {
    return Buffer.from([0x1B, 0x21, 0x00]);
}

function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function line(text = '') {
    return String(text) + '\n';
}

function separator() {
    return '-'.repeat(RECEIPT_WIDTH) + '\n';
}

function productSeparator() {
    return '.'.repeat(RECEIPT_WIDTH) + '\n';
}

function center(text) {
    const s = String(text ?? '');
    const pad = Math.max(0, Math.floor((RECEIPT_WIDTH - s.length) / 2));
    return ' '.repeat(pad) + s + '\n';
}

function centerBig(text) {
    const s = String(text ?? '').trim();
    const bigWidth = Math.floor(RECEIPT_WIDTH / 2);
    if (s.length >= bigWidth) return s + '\n';
    const padLeft = Math.floor((bigWidth - s.length) / 2);
    return ' '.repeat(padLeft) + s + '\n';
}

function formatRight(name, price) {
    const priceStr = String(price ?? '');
    const maxNameWidth = RECEIPT_WIDTH - priceStr.length - 1;
    let itemName = String(name ?? '');
    if (itemName.length > maxNameWidth) {
        itemName = itemName.slice(0, Math.max(0, maxNameWidth - 3)) + '...';
    }
    const space = Math.max(1, RECEIPT_WIDTH - itemName.length - priceStr.length);
    return itemName + ' '.repeat(space) + priceStr + '\n';
}

function wrapText(text) {
    const words = String(text ?? '').split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        if ((current + word).length > RECEIPT_WIDTH - 6) {
            if (current.trim()) lines.push(current.trim());
            current = word + ' ';
        } else {
            current += word + ' ';
        }
    }
    if (current.trim()) lines.push(current.trim());
    return lines;
}

function isCardPayment(order) {
    return (order?.paymentMethod || order?.payment?.method) === 'card';
}

function isCardPaid(order) {
    const status = order?.paymentStatus || order?.payment?.status || '';
    return String(status).toLowerCase() === 'paid';
}

function isDeliveryOrder(order) {
    return order?.deliveryMethod === 'delivery' || order?.deliveryType === 'delivery';
}

function calculateEstimatedTime(order) {
    if (!order?.estimatedTime) return null;
    const baseTime = new Date(order.createdAt);
    const minutes = Number(order.estimatedTime);
    if (Number.isNaN(minutes)) return null;
    baseTime.setMinutes(baseTime.getMinutes() + minutes);
    return baseTime.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
}

function getReceiptHeader(order) {
    const header = (order?.restaurantName || order?.restaurant?.name || 'BOJOLE').toString().trim();
    return header || 'BOJOLE';
}

function execFileAsync(file, args, options) {
    return new Promise((resolve, reject) => {
        execFile(file, args, options || {}, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

function escapePsSingleQuotes(value) {
    return String(value || '').replace(/'/g, "''");
}

function stripEscPos(receiptText) {
    let t = String(receiptText || '');

    // Remove our template markers (used for big text)
    t = t.replace(/\[\[BIG_START\]\]/g, '');
    t = t.replace(/\[\[BIG_END\]\]/g, '');

    // Common ESC/POS sequences used in our receipts
    t = t.replace(/\x1B@/g, '');
    t = t.replace(/\x1B[!a][\x00-\xFF]/g, '');
    t = t.replace(/\x1D[Vv][\x00-\xFF]/g, '');
    t = t.replace(/[\x1B\x1D]/g, '');

    // Strip remaining control chars except newlines and tabs
    t = t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return t;
}

async function sendToWindowsPrinter(printerName, text) {
    const name = String(printerName || '').trim();
    if (!name) return { ok: false, error: 'Missing printer name' };

    if (process.platform !== 'win32') {
        return { ok: false, error: 'Printer-name printing is only supported on Windows' };
    }

    const tmpFile = path.join(
        os.tmpdir(),
        `restaurant-receipt-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`
    );

    try {
        fs.writeFileSync(tmpFile, String(text || ''), { encoding: 'utf8' });

        const p = escapePsSingleQuotes(tmpFile);
        const n = escapePsSingleQuotes(name);

        const ps = [
            `$p='${p}';`,
            `$n='${n}';`,
            `Get-Content -LiteralPath $p -Raw -Encoding UTF8 | Out-Printer -Name $n;`
        ].join(' ');

        await execFileAsync('powershell', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            ps
        ], {
            windowsHide: true,
            timeout: 20000,
            maxBuffer: 1024 * 1024
        });

        return { ok: true };
    } catch (e) {
        const msg = (e?.stderr || e?.message || 'Failed to print via Windows spooler').toString().trim();
        return { ok: false, error: msg };
    } finally {
        try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
    }
}

async function listWindowsPrinters() {
    if (process.platform !== 'win32') return [];

    // Prefer Get-Printer when available (PrintManagement module)
    try {
        const ps = "try { Get-Printer | Select-Object Name,DriverName,PortName,Shared,Default | ConvertTo-Json -Depth 2 } catch { '' }";
        const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
            windowsHide: true,
            timeout: 10000,
            maxBuffer: 1024 * 1024
        });

        const raw = (stdout || '').toString().trim();
        if (raw) {
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            return arr
                .filter(p => p && p.Name)
                .map(p => ({
                    name: String(p.Name),
                    driverName: (p.DriverName || '').toString(),
                    portName: (p.PortName || '').toString(),
                    shared: !!p.Shared,
                    isDefault: !!p.Default
                }));
        }
    } catch (e) {
        // ignore; fallback below
    }

    // Fallback: WMIC (legacy)
    try {
        const { stdout } = await execFileAsync('wmic', ['printer', 'get', 'name'], {
            windowsHide: true,
            timeout: 10000,
            maxBuffer: 1024 * 1024
        });
        const lines = (stdout || '').toString().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const names = lines.slice(1); // drop header
        return names.map(n => ({ name: n }));
    } catch (e) {
        return [];
    }
}

/**
 * Търсене на ESC/POS принтери в локалната мрежа
 * Сканира порт 9100 (стандартен за мрежови принтери)
 */
async function findNetworkPrinters(options = {}) {
    const printers = [];
    const localIp = getLocalIP();
    
    const port = Number.isFinite(Number(options.port)) ? Number(options.port) : 9100;
    const timeout = Number.isFinite(Number(options.timeout)) ? Number(options.timeout) : 500;
    const concurrency = Math.max(1, Math.min(100, Number.isFinite(Number(options.concurrency)) ? Number(options.concurrency) : 50));

    // Allow passing explicit subnet like "192.168.88" (preferred for testing)
    const requestedSubnet = (options.subnet || '').toString().trim();

    const seedIp = requestedSubnet ? (requestedSubnet.includes('.') ? requestedSubnet + '.1' : '') : localIp;

    if (!seedIp) {
        console.log('Could not determine local IP');
        return printers;
    }

    const subnet = seedIp.substring(0, seedIp.lastIndexOf('.'));

    console.log(`Scanning network ${subnet}.0/24 for printers (port ${port}, timeout ${timeout}ms, concurrency ${concurrency})...`);

    // Build scan list 1..254
    const ips = [];
    for (let i = 1; i <= 254; i++) {
        ips.push(`${subnet}.${i}`);
    }

    // Concurrency-limited scan
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, ips.length) }, async () => {
        while (cursor < ips.length) {
            const ip = ips[cursor++];
            // eslint-disable-next-line no-await-in-loop
            const ok = await checkPrinterPort(ip, port, timeout);
            if (ok) {
                printers.push({
                    ip,
                    port,
                    name: `Network Printer at ${ip}`
                });
            }
        }
    });

    await Promise.all(workers);

    console.log(`Found ${printers.length} printer(s)`);
    return printers;
}

/**
 * Проверка дали има принтер на даден IP и порт
 */
function checkPrinterPort(ip, port, timeout = 500) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let resolved = false;

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
                resolve(true);
            }
        });

        socket.on('timeout', () => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
                resolve(false);
            }
        });

        socket.on('error', () => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
                resolve(false);
            }
        });

        socket.connect(port, ip);
    });
}

/**
 * Получаване на локалния IP адрес
 */
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Пропускаме интерфейси които не са IPv4 или са loopback
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    
    return null;
}

/**
 * Принтиране на поръчка
 */
async function printOrder(order, printerTarget = null) {
    try {
        let printer = null;

        // Windows printer by name (uses installed driver/spooler)
        if (printerTarget && typeof printerTarget === 'object') {
            const pn = (printerTarget.name || printerTarget.printerName || '').toString().trim();
            if (pn) {
                const receiptRaw = generateReceiptText(order);
                const receiptPlain = stripEscPos(receiptRaw);
                const r = await sendToWindowsPrinter(pn, receiptPlain);
                if (r.ok) {
                    console.log('Order printed successfully (Windows spooler)');
                    return { success: true, printer: pn, mode: 'windows' };
                }
                console.log('Failed to print order (Windows spooler)');
                return { success: false, error: r.error || 'Failed to print via Windows spooler', mode: 'windows' };
            }
        }

        if (printerTarget) {
            // Използване на конкретен принтер
            if (typeof printerTarget === 'string') {
                printer = { ip: printerTarget, port: 9100 };
            } else if (typeof printerTarget === 'object' && printerTarget.ip) {
                printer = {
                    ip: String(printerTarget.ip).trim(),
                    port: Number.isFinite(Number(printerTarget.port)) ? Number(printerTarget.port) : 9100
                };
            } else {
                return { success: false, error: 'Invalid printer target' };
            }
        } else {
            // Автоматично търсене на принтер
            const printers = await findNetworkPrinters();
            
            if (printers.length === 0) {
                console.log('No printers found on network');
                return { success: false, error: 'No printers found' };
            }

            printer = printers[0]; // Използваме първия намерен принтер
            console.log(`Using printer at ${printer.ip}`);
        }

        // Създаване на receipt текст
        const receipt = generateReceiptText(order);

        // Изпращане към принтера
        const printed = await sendToPrinter(printer.ip, printer.port, receipt);

        if (printed) {
            console.log('Order printed successfully');
            return { success: true, printer: printer.ip };
        } else {
            console.log('Failed to print order');
            return { success: false, error: 'Failed to send to printer' };
        }

    } catch (error) {
        console.error('Error printing order:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Принтиране само на ОБЩАТА БЕЛЕЖКА (customerInfo.notes)
 */
async function printOrderNote(order, printerTarget = null) {
    try {
        let printer = null;

        // Windows printer by name (uses installed driver/spooler)
        if (printerTarget && typeof printerTarget === 'object') {
            const pn = (printerTarget.name || printerTarget.printerName || '').toString().trim();
            if (pn) {
                const receiptRaw = generateNoteReceiptText(order);
                const receiptPlain = stripEscPos(receiptRaw);
                const r = await sendToWindowsPrinter(pn, receiptPlain);
                if (r.ok) {
                    console.log('Order note printed successfully (Windows spooler)');
                    return { success: true, printer: pn, mode: 'windows' };
                }
                console.log('Failed to print order note (Windows spooler)');
                return { success: false, error: r.error || 'Failed to print via Windows spooler', mode: 'windows' };
            }
        }

        if (printerTarget) {
            if (typeof printerTarget === 'string') {
                printer = { ip: printerTarget, port: 9100 };
            } else if (typeof printerTarget === 'object' && printerTarget.ip) {
                printer = {
                    ip: String(printerTarget.ip).trim(),
                    port: Number.isFinite(Number(printerTarget.port)) ? Number(printerTarget.port) : 9100
                };
            } else {
                return { success: false, error: 'Invalid printer target' };
            }
        } else {
            const printers = await findNetworkPrinters();
            if (printers.length === 0) {
                console.log('No printers found on network');
                return { success: false, error: 'No printers found' };
            }
            printer = printers[0];
            console.log(`Using printer at ${printer.ip}`);
        }

        const receipt = generateNoteReceiptText(order);
        const printed = await sendToPrinter(printer.ip, printer.port, receipt);

        if (printed) {
            console.log('Order note printed successfully');
            return { success: true, printer: printer.ip };
        }

        console.log('Failed to print order note');
        return { success: false, error: 'Failed to send to printer' };
    } catch (error) {
        console.error('Error printing order note:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Генериране на текст за касова бележка (ESC/POS команди)
 */
function generateReceiptText(order) {
    let r = '';

    const header = getReceiptHeader(order);
    const isCard = isCardPayment(order);
    const paid = isCardPaid(order);
    const isDelivery = isDeliveryOrder(order);

    r += center(header);
    r += separator();

    r += '[[BIG_START]]';
    r += centerBig(isCard && paid ? 'ПЛАТЕНА' : 'НАЛОЖЕН ПЛАТЕЖ');
    r += centerBig(isDelivery ? 'ДОСТАВКА' : 'ВЗИМАНЕ ОТ МЯСТО');
    r += '[[BIG_END]]';

    r += separator();

    if (order?.orderTime === 'later' && order?.scheduledTime) {
        r += '[[BIG_START]]';
        r += centerBig('ПО-КЪСНО: ' + order.scheduledTime);
        r += '[[BIG_END]]';
        r += separator();
    } else if (order?.estimatedTime) {
        const estimated = calculateEstimatedTime(order);
        if (estimated) {
            r += '[[BIG_START]]';
            r += centerBig('ЗА: ' + estimated);
            r += '[[BIG_END]]';
            r += separator();
        }
    }

    r += line('Поръчка: ' + (order?.id ?? ''));

    try {
        if (order?.createdAt) {
            r += line('Час на поръчка: ' + new Date(order.createdAt).toLocaleString('bg-BG'));
        }
    } catch {
        // ignore
    }

    r += separator();

    r += line('КЛИЕНТ:');
    r += line(order?.customerInfo?.name || '');
    r += line(order?.customerInfo?.phone || '');

    if (order?.customerInfo?.notes) {
        r += separator();
        r += line('ОБЩА БЕЛЕЖКА:');
        wrapText(order.customerInfo.notes).forEach(l => { r += line('   ' + l); });
        r += separator();
    }

    if (isDelivery) {
        r += separator();
        r += line('ДОСТАВКА:');
        r += line(order?.customerInfo?.address || '');
    }

    r += separator();
    r += line('ПРОДУКТИ:');
    r += separator();

    (order?.items || []).forEach(item => {
        const qty = Number(item?.quantity) || 1;
        const unitPrice = round2(item?.promoPrice ?? item?.price ?? 0);
        const lineTotal = round2(unitPrice * qty);

        r += formatRight(`${qty}x ${item?.name || ''}`, lineTotal.toFixed(2) + ' лв');

        const note = (item?.note || '').toString().replace(/\r/g, '').trim();
        if (note) {
            r += line('   Бележка:');
            wrapText(note).forEach(l => { r += line('     ' + l); });
            r += productSeparator();
        }
    });

    const subtotal = round2(order?.subtotal ?? 0);
    const discount = round2(order?.discountAmount ?? 0);
    const delivery = round2(order?.deliveryFee ?? 0);
    const finalTotal = round2(order?.finalTotal ?? order?.total ?? 0);

    r += separator();
    if (subtotal > 0) r += formatRight('Сума:', subtotal.toFixed(2) + ' лв');
    if (discount > 0) r += formatRight('Отстъпка:', '- ' + discount.toFixed(2) + ' лв');
    if (subtotal > 0 || discount > 0) r += formatRight('Междинна сума:', (subtotal - discount).toFixed(2) + ' лв');
    if (delivery > 0) r += formatRight('Доставка:', delivery.toFixed(2) + ' лв');
    r += separator();
    r += formatRight('ОБЩО:', finalTotal.toFixed(2) + ' лв');

    r += separator();
    r += center('Благодарим Ви!');
    r += '\n';

    return r;
}

function generateNoteReceiptText(order) {
    let r = '';
    const header = getReceiptHeader(order);

    r += center(header);
    r += separator();

    r += '[[BIG_START]]';
    r += centerBig('БЕЛЕЖКА');
    r += '[[BIG_END]]';

    r += separator();

    const orderId = (order?.id ?? '').toString();
    if (orderId) r += line('Поръчка: ' + orderId);

    const createdAt = order?.createdAt || order?.timestamp || order?.created_at;
    if (createdAt) {
        try {
            r += line('Час: ' + new Date(createdAt).toLocaleString('bg-BG'));
        } catch {
            // ignore
        }
    }

    const name = (order?.customerInfo?.name || '').toString().trim();
    const phone = (order?.customerInfo?.phone || '').toString().trim();
    if (name || phone) {
        r += separator();
        if (name) r += line('КЛИЕНТ: ' + name);
        if (phone) r += line('ТЕЛ: ' + phone);
    }

    r += separator();
    r += line('ОБЩА БЕЛЕЖКА:');
    const note = (order?.customerInfo?.notes || order?.customerInfo?.note || '').toString().replace(/\r/g, '').trim();
    if (!note) {
        r += line('   (Няма бележка)');
    } else {
        wrapText(note).forEach(l => { r += line('   ' + l); });
    }

    const items = Array.isArray(order?.items) ? order.items : [];
    const itemsWithNotes = items.filter(i => (i?.note || '').toString().trim());
    if (itemsWithNotes.length) {
        r += separator();
        r += line('БЕЛЕЖКИ ПО ПРОДУКТИ:');
        itemsWithNotes.forEach(item => {
            const qty = Number(item?.quantity) || 1;
            const itemName = (item?.name || '').toString().trim();
            const itemNote = (item?.note || '').toString().replace(/\r/g, '').trim();
            r += line(`${qty}x ${itemName}`);
            wrapText(itemNote).forEach(l => { r += line('   ' + l); });
            r += productSeparator();
        });
    }

    r += separator();
    r += center('Благодарим Ви!');
    r += '\n';

    return r;
}

/**
 * Изпращане на данни към принтера
 */
function sendToPrinter(ip, port, data) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let sent = false;

        socket.setTimeout(5000);

        socket.on('connect', () => {
            console.log(`Connected to printer at ${ip}:${port}`);
            try {
                const ESC = 0x1B;
                const GS = 0x1D;

                const bufferParts = [];
                bufferParts.push(Buffer.from([ESC, 0x40]));

                // Select code table: 46 (Windows-1251) on most Epson-compatible ESC/POS printers
                bufferParts.push(Buffer.from([ESC, 0x74, 46]));

                const receiptText = String(data || '');
                const segments = receiptText.split(/(\[\[BIG_START\]\]|\[\[BIG_END\]\])/);

                for (const seg of segments) {
                    if (seg === '[[BIG_START]]') {
                        bufferParts.push(escposBigSize());
                    } else if (seg === '[[BIG_END]]') {
                        bufferParts.push(escposNormalSize());
                    } else if (seg && seg.length > 0) {
                        bufferParts.push(iconv.encode(seg, 'win1251'));
                    }
                }

                bufferParts.push(iconv.encode('\n\n\n\n', 'win1251'));
                bufferParts.push(Buffer.from([GS, 0x56, 0x00]));

                const buffer = Buffer.concat(bufferParts);

                socket.write(buffer, (err) => {
                    if (err) {
                        console.error('Error writing to printer:', err);
                        sent = false;
                    } else {
                        console.log('Data sent to printer');
                        sent = true;
                    }

                    setTimeout(() => {
                        socket.destroy();
                        resolve(sent);
                    }, 800);
                });
            } catch (e) {
                console.error('Failed to build/send receipt buffer:', e.message);
                try { socket.destroy(); } catch { /* ignore */ }
                resolve(false);
            }
        });

        socket.on('error', (err) => {
            console.error('Printer socket error:', err.message);
            socket.destroy();
            resolve(false);
        });

        socket.on('timeout', () => {
            console.error('Printer connection timeout');
            socket.destroy();
            resolve(false);
        });

        socket.connect(port, ip);
    });
}

/**
 * Тестване на принтер
 */
async function testPrinter(ip = null, port = 9100) {
    try {
        let printerIp = ip;

        if (!printerIp) {
            const printers = await findNetworkPrinters();
            if (printers.length === 0) {
                console.log('No printers found');
                return false;
            }
            printerIp = printers[0].ip;
        }

        const testData = '\x1B@Test Print\n\n\n\x1DVA';
        const p = Number.isFinite(Number(port)) ? Number(port) : 9100;
        const result = await sendToPrinter(printerIp, p, testData);
        
        return result;
    } catch (error) {
        console.error('Error testing printer:', error);
        return false;
    }
}

module.exports = {
    findNetworkPrinters,
    printOrder,
    printOrderNote,
    testPrinter,
    listWindowsPrinters,
    getLocalIP
};
