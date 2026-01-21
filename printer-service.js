const net = require('net');
const os = require('os');

/**
 * Търсене на ESC/POS принтери в локалната мрежа
 * Сканира порт 9100 (стандартен за мрежови принтери)
 */
async function findNetworkPrinters() {
    const printers = [];
    const localIp = getLocalIP();
    
    if (!localIp) {
        console.log('Could not determine local IP');
        return printers;
    }

    const subnet = localIp.substring(0, localIp.lastIndexOf('.'));
    const scanPromises = [];

    console.log(`Scanning network ${subnet}.0/24 for printers...`);

    // Сканиране на IP адреси от 1 до 254
    for (let i = 1; i <= 254; i++) {
        const ip = `${subnet}.${i}`;
        scanPromises.push(checkPrinterPort(ip, 9100));
    }

    const results = await Promise.allSettled(scanPromises);
    
    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
            const ip = `${subnet}.${index + 1}`;
            printers.push({
                ip: ip,
                port: 9100,
                name: `Network Printer at ${ip}`
            });
        }
    });

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
async function printOrder(order, printerIp = null) {
    try {
        let printer = null;

        if (printerIp) {
            // Използване на конкретен принтер
            printer = { ip: printerIp, port: 9100 };
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
async function testPrinter(ip = null) {
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
        const result = await sendToPrinter(printerIp, 9100, testData);
        
        return result;
    } catch (error) {
        console.error('Error testing printer:', error);
        return false;
    }
}

module.exports = {
    findNetworkPrinters,
    printOrder,
    testPrinter,
    getLocalIP
};
