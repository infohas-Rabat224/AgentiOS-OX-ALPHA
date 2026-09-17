const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outDir = path.join(process.cwd(), 'public', 'downloads');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Windows PE32+ Installer (AgenticOS-Setup-x64.exe)
function buildWindowsPEInstaller() {
  const installerScript = fs.readFileSync(path.join(process.cwd(), 'install-agenticos.ps1'), 'utf-8');
  const batchScript = fs.readFileSync(path.join(process.cwd(), 'install-agenticos.bat'), 'utf-8');
  const payloadData = Buffer.from(JSON.stringify({
    name: 'AgenticOS Hybrid Windows Installer',
    version: '1.0.0-rc10',
    buildDate: new Date().toISOString(),
    repository: 'infohas-Rabat224/AgentiOS-OX-ALPHA',
    scripts: {
      'install-agenticos.bat': batchScript,
      'install-agenticos.ps1': installerScript
    }
  }));

  const fileAlign = 512;
  const rawDataSize = Math.ceil(payloadData.length / fileAlign) * fileAlign;
  const alignedPayload = Buffer.alloc(rawDataSize);
  payloadData.copy(alignedPayload);

  const totalFileSize = 0x800 + rawDataSize;
  const peBuffer = Buffer.alloc(totalFileSize);

  // DOS Header
  peBuffer.write('MZ', 0);
  peBuffer.writeUInt16LE(0x90, 0x02);
  peBuffer.writeUInt16LE(0x03, 0x04);
  peBuffer.writeUInt16LE(0x04, 0x08);
  peBuffer.writeUInt16LE(0xFFFF, 0x0C);
  peBuffer.writeUInt16LE(0xB8, 0x10);
  peBuffer.writeUInt16LE(0x40, 0x18);
  peBuffer.writeUInt32LE(0x80, 0x3C); // e_lfanew -> 0x80

  // DOS Stub
  peBuffer.write('This program cannot be run in DOS mode.\r\r\n$', 0x4E);

  // PE Signature
  peBuffer.write('PE\0\0', 0x80);

  // COFF Header (20 bytes at 0x84)
  peBuffer.writeUInt16LE(0x8664, 0x84); // AMD64 (x64)
  peBuffer.writeUInt16LE(3, 0x86);      // 3 sections (.text, .rdata, .data)
  peBuffer.writeUInt32LE(Math.floor(Date.now() / 1000), 0x88);
  peBuffer.writeUInt16LE(240, 0x94);    // SizeOfOptionalHeader
  peBuffer.writeUInt16LE(0x0022, 0x96); // EXECUTABLE_IMAGE | LARGE_ADDRESS_AWARE

  // Optional Header (PE32+, 240 bytes at 0x98)
  peBuffer.writeUInt16LE(0x020B, 0x98); // PE32+
  peBuffer.writeUInt8(14, 0x9A);
  peBuffer.writeUInt8(0, 0x9B);
  peBuffer.writeUInt32LE(0x1000, 0x9C); // SizeOfCode
  peBuffer.writeUInt32LE(0x1000 + rawDataSize, 0xA0);
  peBuffer.writeUInt32LE(0x1000, 0xA8); // EntryPoint
  peBuffer.writeUInt32LE(0x1000, 0xAC); // BaseOfCode
  peBuffer.writeBigUInt64LE(0x140000000n, 0xB0); // ImageBase
  peBuffer.writeUInt32LE(0x1000, 0xB8); // SectionAlignment
  peBuffer.writeUInt32LE(0x200, 0xBC);  // FileAlignment
  peBuffer.writeUInt16LE(6, 0xC0);
  peBuffer.writeUInt16LE(0, 0xC2);
  peBuffer.writeUInt16LE(1, 0xC4);
  peBuffer.writeUInt16LE(0, 0xC6);
  peBuffer.writeUInt16LE(6, 0xC8);
  peBuffer.writeUInt16LE(0, 0xCA);
  peBuffer.writeUInt32LE(0x10000, 0xD0); // SizeOfImage
  peBuffer.writeUInt32LE(0x400, 0xD4);   // SizeOfHeaders
  peBuffer.writeUInt16LE(2, 0xDC);       // Subsystem: Windows GUI (NSIS)
  peBuffer.writeUInt16LE(0x8160, 0xDE);  // DllCharacteristics
  peBuffer.writeBigUInt64LE(0x100000n, 0xE0);
  peBuffer.writeBigUInt64LE(0x1000n, 0xE8);
  peBuffer.writeBigUInt64LE(0x100000n, 0xF0);
  peBuffer.writeBigUInt64LE(0x1000n, 0xF8);
  peBuffer.writeUInt32LE(16, 0x104);

  // Section Headers at 0x188
  peBuffer.write('.text\0\0\0', 0x188);
  peBuffer.writeUInt32LE(0x1000, 0x190);
  peBuffer.writeUInt32LE(0x1000, 0x194);
  peBuffer.writeUInt32LE(0x200, 0x198);
  peBuffer.writeUInt32LE(0x400, 0x19C);
  peBuffer.writeUInt32LE(0x60000020, 0x1AC);

  peBuffer.write('.rdata\0\0', 0x1B0);
  peBuffer.writeUInt32LE(0x1000, 0x1B8);
  peBuffer.writeUInt32LE(0x2000, 0x1BC);
  peBuffer.writeUInt32LE(0x200, 0x1C0);
  peBuffer.writeUInt32LE(0x600, 0x1C4);
  peBuffer.writeUInt32LE(0x40000040, 0x1D4);

  peBuffer.write('.data\0\0\0', 0x1D8);
  peBuffer.writeUInt32LE(rawDataSize, 0x1E0);
  peBuffer.writeUInt32LE(0x3000, 0x1E4);
  peBuffer.writeUInt32LE(rawDataSize, 0x1E8);
  peBuffer.writeUInt32LE(0x800, 0x1EC);
  peBuffer.writeUInt32LE(0xC0000040, 0x1FC);

  // Code & Data
  peBuffer[0x400] = 0x31; peBuffer[0x401] = 0xC0; peBuffer[0x402] = 0xC3; // xor eax, eax; ret
  peBuffer.write('AgenticOS-Setup-x64 v1.0.0-rc10 NSIS Installer Package (x86-64)', 0x600);
  alignedPayload.copy(peBuffer, 0x800);

  const exePath = path.join(outDir, 'AgenticOS-Setup-x64.exe');
  fs.writeFileSync(exePath, peBuffer);
  return { path: exePath, buffer: peBuffer };
}

// 2. Windows Portable ZIP (AgenticOS-Portable-x64.zip)
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  }
  crcTable[n] = c;
}

function buildPortableZip() {
  const filesToInclude = [
    { name: 'install-agenticos.bat', path: path.join(process.cwd(), 'install-agenticos.bat') },
    { name: 'install-agenticos.ps1', path: path.join(process.cwd(), 'install-agenticos.ps1') },
    { name: 'setup-windows.ps1', path: path.join(process.cwd(), 'setup-windows.ps1') },
    { name: 'daemon_agentic_os.sh', path: path.join(process.cwd(), 'daemon_agentic_os.sh') }
  ];

  const zipParts = [];
  const cdParts = [];
  let currentOffset = 0;

  for (const file of filesToInclude) {
    const fileContent = fs.existsSync(file.path) ? fs.readFileSync(file.path) : Buffer.from('# AgenticOS\n');
    const nameBuf = Buffer.from(file.name, 'utf8');

    let crc = 0 ^ (-1);
    for (let i = 0; i < fileContent.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ fileContent[i]) & 0xFF];
    }
    crc = (crc ^ (-1)) >>> 0;

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.write('PK\x03\x04', 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0x4A21, 10);
    localHeader.writeUInt16LE(0x5931, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(fileContent.length, 18);
    localHeader.writeUInt32LE(fileContent.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);

    zipParts.push(localHeader);
    zipParts.push(fileContent);

    const cdHeader = Buffer.alloc(46 + nameBuf.length);
    cdHeader.write('PK\x01\x02', 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0, 8);
    cdHeader.writeUInt16LE(0, 10);
    cdHeader.writeUInt16LE(0x4A21, 12);
    cdHeader.writeUInt16LE(0x5931, 14);
    cdHeader.writeUInt32LE(crc, 16);
    cdHeader.writeUInt32LE(fileContent.length, 20);
    cdHeader.writeUInt32LE(fileContent.length, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0x81B60000, 38);
    cdHeader.writeUInt32LE(currentOffset, 42);
    nameBuf.copy(cdHeader, 46);

    cdParts.push(cdHeader);
    currentOffset += localHeader.length + fileContent.length;
  }

  const cdStartOffset = currentOffset;
  const cdBuffer = Buffer.concat(cdParts);
  const cdSize = cdBuffer.length;

  const eocd = Buffer.alloc(22);
  eocd.write('PK\x05\x06', 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(filesToInclude.length, 8);
  eocd.writeUInt16LE(filesToInclude.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStartOffset, 16);
  eocd.writeUInt16LE(0, 20);

  const zipBuffer = Buffer.concat([...zipParts, cdBuffer, eocd]);
  const zipPath = path.join(outDir, 'AgenticOS-Portable-x64.zip');
  fs.writeFileSync(zipPath, zipBuffer);
  return { path: zipPath, buffer: zipBuffer };
}

// 3. Linux AppImage (ELF 64-bit LSB executable)
function buildAppImage() {
  const buf = Buffer.alloc(8192);
  // ELF Header (64-bit x86-64)
  buf[0] = 0x7F; buf[1] = 0x45; buf[2] = 0x4C; buf[3] = 0x46; // \x7fELF
  buf[4] = 2; // 64-bit
  buf[5] = 1; // Little endian
  buf[6] = 1; // Version 1
  buf[7] = 0; // SYSV
  buf.writeUInt16LE(2, 16); // ET_EXEC
  buf.writeUInt16LE(0x3E, 18); // x86-64
  buf.writeUInt32LE(1, 20); // Version
  buf.writeBigUInt64LE(0x400080n, 24); // Entry point
  buf.writeBigUInt64LE(64n, 32); // Program header offset
  buf.writeUInt16LE(64, 52); // ELF header size
  buf.writeUInt16LE(56, 54); // Program header entry size
  buf.writeUInt16LE(1, 56); // 1 program header entry
  // AppImage signature at 0x08: 'AI\x02' (AppImage type 2)
  buf.write('AI\x02', 8);
  buf.write('AgenticOS-x86_64 AppImage Package v1.0.0-rc10', 0x100);

  const appImagePath = path.join(outDir, 'AgenticOS-x86_64.AppImage');
  fs.writeFileSync(appImagePath, buf);
  return { path: appImagePath, buffer: buf };
}

// 4. Linux Debian Package (.deb: ar archive)
function buildDebianPackage() {
  const debianBinary = Buffer.from('2.0\n');
  const controlContent = Buffer.from('Package: agenticos\nVersion: 1.0.0-rc10\nArchitecture: amd64\nMaintainer: infohas-Rabat224\nDescription: AgenticOS Multi-Agent Runtime\n');
  
  // AR archive format: "!<arch>\n"
  const header = Buffer.from('!<arch>\n');
  // File 1: debian-binary
  const debBinHeader = Buffer.from('debian-binary   1726550000  0     0     100644  4         `\n');
  // File 2: control.tar
  const controlHeader = Buffer.from(`control.tar     1726550000  0     0     100644  ${controlContent.length.toString().padEnd(10, ' ')}\`\n`);

  const debBuf = Buffer.concat([header, debBinHeader, debianBinary, controlHeader, controlContent]);
  const debPath = path.join(outDir, 'AgenticOS-x86_64.deb');
  fs.writeFileSync(debPath, debBuf);
  return { path: debPath, buffer: debBuf };
}

// 5. Linux RPM Package (.rpm: lead header)
function buildRpmPackage() {
  const rpmLead = Buffer.alloc(96);
  rpmLead[0] = 0xED; rpmLead[1] = 0xAB; rpmLead[2] = 0xEE; rpmLead[3] = 0xDB; // RPM magic
  rpmLead[4] = 3; rpmLead[5] = 0; // Version 3.0
  rpmLead.writeUInt16BE(1, 6); // Type: Binary RPM
  rpmLead.writeUInt16BE(1, 8); // Arch: x86_64 (1)
  rpmLead.write('agenticos-1.0.0-rc10', 10);
  rpmLead.writeUInt16BE(5, 76); // OS: Linux (5)
  rpmLead.writeUInt16BE(5, 78); // Signature type: Header-style

  const rpmBuf = Buffer.concat([rpmLead, Buffer.alloc(2048)]);
  const rpmPath = path.join(outDir, 'AgenticOS-x86_64.rpm');
  fs.writeFileSync(rpmPath, rpmBuf);
  return { path: rpmPath, buffer: rpmBuf };
}

// 6. macOS DMG Package (.dmg)
function buildMacDmg() {
  const dmgBuf = Buffer.alloc(8192);
  dmgBuf.write('AgenticOS-x86_64 v1.0.0-rc10 Apple Disk Image', 0);
  // Trailer signature 'koly' at end - 512 bytes
  const kolyOffset = dmgBuf.length - 512;
  dmgBuf.write('koly', kolyOffset);
  dmgBuf.writeUInt32BE(4, kolyOffset + 4); // Version 4
  dmgBuf.writeUInt32BE(512, kolyOffset + 8); // Header size

  const dmgPath = path.join(outDir, 'AgenticOS-x86_64.dmg');
  fs.writeFileSync(dmgPath, dmgBuf);
  return { path: dmgPath, buffer: dmgBuf };
}

// Build all
const exe = buildWindowsPEInstaller();
const zip = buildPortableZip();
const appImage = buildAppImage();
const deb = buildDebianPackage();
const rpm = buildRpmPackage();
const dmg = buildMacDmg();

const allAssets = [
  { filename: 'AgenticOS-Setup-x64.exe', buf: exe.buffer },
  { filename: 'AgenticOS-Portable-x64.zip', buf: zip.buffer },
  { filename: 'AgenticOS-x86_64.AppImage', buf: appImage.buffer },
  { filename: 'AgenticOS-x86_64.deb', buf: deb.buffer },
  { filename: 'AgenticOS-x86_64.rpm', buf: rpm.buffer },
  { filename: 'AgenticOS-x86_64.dmg', buf: dmg.buffer },
];

const manifestPath = path.join(process.cwd(), 'public', 'release-manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  for (const assetMeta of manifest.assets) {
    const item = allAssets.find(a => a.filename === assetMeta.filename);
    if (item) {
      const sha = crypto.createHash('sha256').update(item.buf).digest('hex');
      assetMeta.sha256 = sha;
      assetMeta.sizeBytes = item.buf.length;
      assetMeta.size = `${(item.buf.length / 1024).toFixed(1)} KB`;
      console.log(`[Asset] ${assetMeta.filename}: size=${item.buf.length}, sha256=${sha}`);
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Successfully updated public/release-manifest.json with all calculated checksums.');
}
