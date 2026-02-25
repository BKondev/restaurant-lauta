const net = require('net');
const os = require('os');

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
    const ESC = '\x1B';
    const GS = '\x1D';
    
    let receipt = '';
    
    // Инициализация
    receipt += `${ESC}@`; // Initialize printer
    
    // Заглавие - голям шрифт, центрирано
    receipt += `${ESC}a\x01`; // Center align
    receipt += `${ESC}!\x30`; // Double height + double width
    receipt += 'BOJOLE\n';
    receipt += `${ESC}!\x00`; // Normal text
    receipt += '================================\n';
    
    // Информация за поръчката
    receipt += `${ESC}a\x00`; // Left align
    receipt += `Поръчка #${order.id}\n`;
    receipt += `Дата: ${new Date(order.createdAt).toLocaleString('bg-BG')}\n`;

    // Плащане
    const payMethod = (order?.payment?.method || '').toString().trim().toLowerCase();
    const payStatus = (order?.payment?.status || '').toString().trim().toLowerCase();
    const isCard = payMethod === 'card';
    const isCardPaid = isCard && payStatus === 'paid';

    if (isCardPaid) {
        receipt += `${ESC}!\x08`; // Bold
        receipt += 'ПЛАЩАНЕ: ПЛАТЕНО (КАРТА)\n';
        receipt += `${ESC}!\x00`; // Normal
    } else if (isCard) {
        const statusBg = payStatus === 'pending'
            ? 'ЧАКА ПЛАЩАНЕ'
            : (payStatus === 'failed' || payStatus === 'cancelled' || payStatus === 'canceled')
                ? 'НЕУСПЕШНО'
                : 'НЕ Е ПЛАТЕНО';
        receipt += `${ESC}!\x08`; // Bold
        receipt += `ПЛАЩАНЕ: НЕ Е ПЛАТЕНО (КАРТА: ${statusBg})\n`;
        receipt += `${ESC}!\x00`; // Normal
    } else {
        // Cash (or unknown) is considered NOT PAID at order time
        receipt += `${ESC}!\x08`; // Bold
        receipt += 'ПЛАЩАНЕ: НЕ Е ПЛАТЕНО (В БРОЙ)\n';
        receipt += `${ESC}!\x00`; // Normal
    }

    receipt += '--------------------------------\n';
    
    // Информация за клиента
    receipt += `${ESC}!\x08`; // Bold
    receipt += 'КЛИЕНТ:\n';
    receipt += `${ESC}!\x00`; // Normal
    receipt += `Име: ${order.customerInfo?.name || 'Няма'}\n`;
    receipt += `Тел: ${order.customerInfo?.phone || 'Няма'}\n`;
    
    if (order.deliveryMethod === 'delivery') {
        receipt += `${ESC}!\x08`; // Bold
        receipt += 'ДОСТАВКА:\n';
        receipt += `${ESC}!\x00`; // Normal
        receipt += `Адрес: ${order.customerInfo?.address || ''}\n`;
        receipt += `Град: ${order.customerInfo?.city || ''}\n`;
    } else {
        receipt += 'Вземане от място\n';
    }
    
    receipt += '================================\n';
    
    // Продукти
    receipt += `${ESC}!\x08`; // Bold
    receipt += 'ПРОДУКТИ:\n';
    receipt += `${ESC}!\x00`; // Normal
    receipt += '--------------------------------\n';
    
    order.items.forEach(item => {
        const itemName = item.name.substring(0, 20); // Ограничаваме дължината
        const price = (item.promoPrice || item.price).toFixed(2);
        const total = (price * item.quantity).toFixed(2);
        
        receipt += `${item.quantity}x ${itemName}\n`;
        receipt += `   ${price} лв x ${item.quantity} = ${total} лв\n`;

        if (item.note) {
            const note = String(item.note).trim();
            if (note) {
                receipt += `   Бележка: ${note}\n`;
            }
        }
    });
    
    receipt += '================================\n';
    
    // Обща сума
    receipt += `${ESC}!\x30`; // Double size
    receipt += `${ESC}a\x02`; // Right align
    receipt += `ОБЩО: ${order.total.toFixed(2)} лв\n`;
    receipt += `${ESC}!\x00`; // Normal
    receipt += `${ESC}a\x00`; // Left align
    
    receipt += '\n\n';
    
    // Бележки
    if (order.customerInfo?.notes) {
        receipt += 'БЕЛЕЖКИ:\n';
        receipt += `${order.customerInfo.notes}\n`;
        receipt += '\n';
    }
    
    receipt += `${ESC}a\x01`; // Center
    receipt += 'Благодарим Ви!\n';
    receipt += 'www.bojole.bg\n';
    
    // Изрязване на хартията
    receipt += '\n\n\n';
    receipt += `${GS}V\x00`; // Full cut
    
    return receipt;
}

function generateNoteReceiptText(order) {
    const ESC = '\x1B';

    let receipt = '';

    receipt += `${ESC}@`;
    receipt += `${ESC}a\x01`;
    receipt += `${ESC}!\x30`;
    receipt += 'BOJOLE\n';
    receipt += `${ESC}!\x00`;
    receipt += '================================\n';

    receipt += `${ESC}a\x00`;
    receipt += `БЕЛЕЖКА ЗА ПОРЪЧКА\n`;
    receipt += `Поръчка #${order?.id || ''}\n`;

    try {
        if (order?.createdAt) {
            receipt += `Дата: ${new Date(order.createdAt).toLocaleString('bg-BG')}\n`;
        }
    } catch (e) {
        // ignore
    }

    const name = (order?.customerInfo?.name || '').toString().trim();
    const phone = (order?.customerInfo?.phone || '').toString().trim();
    if (name || phone) {
        receipt += '--------------------------------\n';
        if (name) receipt += `Клиент: ${name}\n`;
        if (phone) receipt += `Тел: ${phone}\n`;
    }

    receipt += '================================\n';
    receipt += `${ESC}!\x08`;
    receipt += 'ОБЩА БЕЛЕЖКА:\n';
    receipt += `${ESC}!\x00`;

    const note = (order?.customerInfo?.notes || '').toString().replace(/\r/g, '').trim();
    if (!note) {
        receipt += '(Няма бележка)\n';
    } else {
        receipt += `${note}\n`;
    }

    receipt += '================================\n';
    receipt += '\n\n\n';

    return receipt;
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
            socket.write(data, 'binary', (err) => {
                if (err) {
                    console.error('Error writing to printer:', err);
                    sent = false;
                } else {
                    console.log('Data sent to printer');
                    sent = true;
                }
                
                // Изчакваме малко преди да затворим връзката
                setTimeout(() => {
                    socket.destroy();
                    resolve(sent);
                }, 1000);
            });
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
    getLocalIP
};
