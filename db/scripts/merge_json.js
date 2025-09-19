// db/scripts/merge_json.js
// Consolida todos os arquivos detalhes_decks_*.json e indice_invertido_*.json em arquivos únicos para a API
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve('api/data');

function mergeDetails() {
    const files = fs.readdirSync(dataDir).filter(f => f.startsWith('detalhes_decks_') && f.endsWith('.json'));
    const merged = {};
    for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
        Object.assign(merged, data);
    }
    fs.writeFileSync(path.join(dataDir, 'detalhes_decks.json'), JSON.stringify(merged, null, 2));
    console.log(`✅ detalhes_decks.json gerado com ${Object.keys(merged).length} decks.`);
}

function mergeIndex() {
    const files = fs.readdirSync(dataDir).filter(f => f.startsWith('indice_invertido_') && f.endsWith('.json'));
    const merged = {};
    for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
        for (const [card, decks] of Object.entries(data)) {
            if (!merged[card]) merged[card] = [];
            merged[card].push(...decks);
        }
    }
    // Remove duplicatas
    for (const card in merged) {
        merged[card] = Array.from(new Set(merged[card]));
    }
    fs.writeFileSync(path.join(dataDir, 'indice_invertido.json'), JSON.stringify(merged, null, 2));
    console.log(`✅ indice_invertido.json gerado com ${Object.keys(merged).length} cartas.`);
}

mergeDetails();
mergeIndex();
