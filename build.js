// enriquecer_dados.js (VERSÃO CORRIGIDA)
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Função auxiliar para adicionar um pequeno delay e não sobrecarregar a API do Scryfall
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const SCRYFALL_API_CHUNK_SIZE = 75;

async function main() {
    console.log("🚀 Iniciando processo de enriquecimento de dados com a API do Scryfall...");
    const dbDir = 'db';
    const dbFiles = fs.readdirSync(dbDir).filter(file => file.endsWith('.db'));

    for (const dbFile of dbFiles) {
        const dbPath = path.join(dbDir, dbFile);
        console.log(`\n--- Processando arquivo: ${dbPath} ---`);
        const db = new Database(dbPath);

        try {
            db.exec('ALTER TABLE decks ADD COLUMN colors TEXT');
            console.log("   - Coluna 'colors' adicionada com sucesso.");
        } catch (error) {
            if (error.message.includes("duplicate column name")) {
                console.log("   - Coluna 'colors' já existe.");
            } else {
                throw error;
            }
        }

        // CORREÇÃO AQUI: Trocamos "" por ''
        const decksToProcess = db.prepare(`
            SELECT deck_id, deck_name FROM decks WHERE colors IS NULL OR colors = ''
        `).all();

        if (decksToProcess.length === 0) {
            console.log("   - Nenhum deck novo para processar. Tudo atualizado!");
            db.close(); // Fecha a conexão se não houver nada a fazer
            continue;
        }

        console.log(`   - Encontrados ${decksToProcess.length} decks para enriquecer...`);

        for (const deck of decksToProcess) {
            const cardsInDeck = db.prepare('SELECT c.card_name FROM deck_cartas dc JOIN cartas c ON dc.card_id = c.card_id WHERE dc.deck_id = ?').all(deck.deck_id);
            const cardIdentifiers = cardsInDeck.map(c => ({ name: c.card_name }));

            // Chunking
            let allCardsData = [];
            for (let i = 0; i < cardIdentifiers.length; i += SCRYFALL_API_CHUNK_SIZE) {
                const chunk = cardIdentifiers.slice(i, i + SCRYFALL_API_CHUNK_SIZE);
                try {
                    const response = await fetch('https://api.scryfall.com/cards/collection', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ identifiers: chunk }),
                    });

                    if (!response.ok) {
                        const errorBody = await response.text();
                        console.error(`     - Erro ao buscar dados para o deck "${deck.deck_name}". Status: ${response.status}. Resposta: ${errorBody}`);
                        continue;
                    }

                    const collection = await response.json();
                    if (collection.data) {
                        allCardsData = allCardsData.concat(collection.data);
                    }
                } catch (error) {
                    console.error(`     - Falha na requisição para o deck "${deck.deck_name}":`, error.message);
                }
                await sleep(100);
            }

            // Processa as cores normalmente
            const colorIdentity = new Set();
            allCardsData.forEach(card => {
                if (card.color_identity) {
                    card.color_identity.forEach(color => colorIdentity.add(color));
                }
            });

            const sortedColors = Array.from(colorIdentity).sort((a, b) => 'WUBRG'.indexOf(a) - 'WUBRG'.indexOf(b)).join('');
            db.prepare('UPDATE decks SET colors = ? WHERE deck_id = ?').run(sortedColors, deck.deck_id);
            console.log(`     - Deck "${deck.deck_name}" atualizado. Cores: ${sortedColors || 'Incolor'}`);
        }
        db.close();
    }
    console.log("\n✅ Processo de enriquecimento de dados concluído!");
}

main();