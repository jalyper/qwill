const pdf = require('pdf-parse');
console.log('--- REQUIRE ---');
console.log('Keys:', Object.keys(pdf));
for (const key of Object.keys(pdf)) {
    console.log(`pdf.${key}:`, typeof pdf[key]);
    if (typeof pdf[key] === 'function') {
        console.log(`FOUND FUNCTION: pdf.${key}`);
    }
}

(async () => {
    console.log('--- IMPORT ---');
    const pdfModule = await import('pdf-parse');
    console.log('Keys:', Object.keys(pdfModule));
    if (pdfModule.default) {
        console.log('Default keys:', Object.keys(pdfModule.default));
    }
})();
