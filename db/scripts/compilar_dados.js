// /db/scripts/compilar_dados.js (Versão final com normalização e diagnóstico)

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

// --- Configuração de Caminhos ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
const dbDir = path.join(projectRoot, 'db');
const outputDir = path.join(projectRoot, 'api', 'data');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const dbFiles = fs.readdirSync(dbDir).filter(f => f.endsWith('.db'));

for (const dbFile of dbFiles) {
    const dbFilePath = path.join(dbDir, dbFile);
    const dbName = path.basename(dbFile, '.db');
    const outputDetailsPath = path.join(outputDir, `detalhes_decks_${dbName}.json`);
    const outputIndexPath = path.join(outputDir, `indice_invertido_${dbName}.json`);

    console.log(`🏁 Iniciando a compilação de dados do banco de dados ${dbFile}...`);

    try {
        const db = new Database(dbFilePath, { readonly: true });
        console.log('✔️ Conectado ao banco de dados SQLite com sucesso.');

        const sqlQuery = `
            SELECT
                d.deck_id, d.deck_name, d.formato, d.updated_at, d.colors,
                c.card_name, dc.quantity, dc.board, dc.category
            FROM deck_cartas AS dc
            JOIN decks AS d ON d.deck_id = dc.deck_id
            JOIN cartas AS c ON c.card_id = dc.card_id
            ORDER BY d.deck_id;
        `;

        const rows = db.prepare(sqlQuery).all();

        if (rows.length === 0) {
            console.log('Nenhum dado encontrado no banco.');
            db.close();
            continue;
        }

        console.log(`🔎 Encontradas ${rows.length} linhas de cartas. Processando...`);

        const deckDetails = {};
        const invertedIndex = {};
        const uniqueBoards = new Set();
        const uniqueCategories = new Set();

        rows.forEach(row => {
            const deckId = row.deck_id;
            if (!deckDetails[deckId]) {
                deckDetails[deckId] = {
                    deck_id: deckId,
                    deck_name: row.deck_name,
                    formato: row.formato,
                    updated_at: row.updated_at,
                    colors: row.colors,
                    mainboard: { categories: {} },
                    sideboard: [],
                    maybeboard: []
                };
            }

            // Normaliza o valor de board
            const board = row.board ? row.board.trim().toLowerCase() : 'mainboard';
            const categoria = row.category ? row.category.trim() : 'Unknown';

            const card = {
                card_name: row.card_name,
                quantity: row.quantity
            };

            if (board === 'mainboard') {
                if (!deckDetails[deckId].mainboard.categories[categoria]) {
                    deckDetails[deckId].mainboard.categories[categoria] = [];
                }
                deckDetails[deckId].mainboard.categories[categoria].push(card);
            } else if (board === 'sideboard') {
                deckDetails[deckId].sideboard.push(card);
            } else if (board === 'maybeboard') {
                deckDetails[deckId].maybeboard.push(card);
            }

            // Indexação invertida
            const cardNameLower = row.card_name.toLowerCase();
            if (!invertedIndex[cardNameLower]) {
                invertedIndex[cardNameLower] = [];
            }
            if (!invertedIndex[cardNameLower].includes(deckId)) {
                invertedIndex[cardNameLower].push(deckId);
            }

            // Diagnóstico
            uniqueBoards.add(board);
            uniqueCategories.add(categoria);
        });

        fs.writeFileSync(outputDetailsPath, JSON.stringify(deckDetails, null, 2));
        fs.writeFileSync(outputIndexPath, JSON.stringify(invertedIndex, null, 2));

        console.log('\n✅ Compilação concluída com sucesso!');
        console.log(`- ${Object.keys(deckDetails).length} decks foram processados.`);
        console.log(`- ${Object.keys(invertedIndex).length} cartas únicas foram indexadas.`);
        console.log(`✔️ Arquivos gerados em: ${outputDir}`);
        console.log('\n--- Diagnóstico de Dados ---');
        console.log('Valores únicos encontrados para a coluna "board":', Array.from(uniqueBoards));
        console.log('Valores únicos encontrados para a coluna "category":', Array.from(uniqueCategories));
        console.log('----------------------------');

        db.close();
        console.log('✔️ Conexão com o banco de dados fechada.');

    } catch (err) {
        console.error('❌ Erro durante a compilação:', err.message);
    }
}