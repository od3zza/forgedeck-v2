// /api/search.js

/**
 * API Response format:
 * {
 *   decks100: [
 *     {
 *       name: string,
 *       updatedAt: string,
 *       percentage: string,
 *       mainboard: { categories: { [category: string]: Array<{ card_name: string, quantity: number, missing: number }> } },
 *       sideboard: Array<{ card_name: string, quantity: number, missing: number }> (can be empty),
 *       maybeboard: Array<{ card_name: string, quantity: number, missing: number }> (can be empty)
 *     },
 *     ...
 *   ],
 *   decks70: [ ...mesmo formato... ]
 * }
 */

import fs from 'fs';
import path from 'path';

/**
 * Converte uma lista de cartas em texto (formato "4 Nome da Carta")
 * para um mapa de { 'nome da carta': quantidade }.
 * Normaliza os nomes para minúsculas.
 * @param {string} cardList - A string contendo a lista de cartas.
 * @returns {Object} - Um mapa com nomes de cartas e suas quantidades.
 */
function parseUserCards(cardList) {
    const userCardsMap = {};
    if (!cardList) return userCardsMap;

    const lines = cardList.split('\n');
    lines.forEach(line => {
        const trimmedLine = line.trim();
        const match = trimmedLine.match(/^(?:(\d+)\s+)?(.+)/);
        if (match) {
            const quantity = parseInt(match[1] || '1', 10);
            const cardName = match[2].trim().toLowerCase();
            if (cardName) {
                userCardsMap[cardName] = (userCardsMap[cardName] || 0) + quantity;
            }
        }
    });
    return userCardsMap;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Only the POST method is allowed' });
    }

    // Validação robusta do corpo da requisição
    const { cardList, format } = req.body || {};
    if (typeof cardList !== 'string' || typeof format !== 'string') {
        return res.status(400).json({ error: 'Campos cardList e format devem ser strings.' });
    }
    // Cada linha não vazia deve começar com número (opcional) e nome
    const lines = cardList.split('\n').map(l => l.trim()).filter(Boolean);
    const regex = /^(\d+\s+)?[\w\-,'’\.()!\/:áéíóúãõâêîôûçÁÉÍÓÚÃÕÂÊÎÔÛÇ ]+$/i;
    if (lines.length === 0 || !lines.every(line => regex.test(line))) {
        return res.status(400).json({ error: 'Formato da lista de cartas inválido. Use uma linha por carta, ex: "4 Lightning Bolt" ou "1 Island".' });
    }

    try {
        // Carrega os arquivos de dados de forma segura a partir da pasta /api/data/
        const dataDirectory = path.join(process.cwd(), 'api/data');
        const invertedIndexFile = fs.readFileSync(path.join(dataDirectory, 'indice_invertido.json'), 'utf8');
        const deckDetailsFile = fs.readFileSync(path.join(dataDirectory, 'detalhes_decks.json'), 'utf8');
        
        const invertedIndex = JSON.parse(invertedIndexFile);
        const deckDetails = JSON.parse(deckDetailsFile);
        
        const userCardsMap = parseUserCards(cardList);
        const userCardNames = Object.keys(userCardsMap);

        const deckScores = {};
        userCardNames.forEach(cardName => {
            if (invertedIndex[cardName]) {
                invertedIndex[cardName].forEach(deckId => {
                    deckScores[deckId] = (deckScores[deckId] || 0) + 1;
                });
            }
        });

        const results = [];
        for (const deckId in deckScores) {
            const deck = deckDetails[deckId];
            // CORREÇÃO: Compara os formatos em minúsculas para evitar erros
            if (!deck || deck.formato.toLowerCase() !== format.toLowerCase()) {
                continue;
            }

            // CORREÇÃO CRÍTICA: Zera os contadores para cada deck
            let totalDeckCards = 0;
            let ownedCardsCount = 0;
            const finalCategories = {};
            const finalSideboard = [];
            const finalMaybeboard = [];

            const processCardList = (list) => {
                const enrichedList = [];
                if (!list) return enrichedList;
                list.forEach(cardInDeck => {
                    const userOwnsQuantity = userCardsMap[cardInDeck.name.toLowerCase()] || 0;
                    const missingQuantity = Math.max(0, cardInDeck.quantity - userOwnsQuantity);
                    totalDeckCards += cardInDeck.quantity;
                    ownedCardsCount += Math.min(cardInDeck.quantity, userOwnsQuantity);
                    enrichedList.push({ ...cardInDeck, missing: missingQuantity });
                });
                return enrichedList;
            };

            // Mainboard (por categorias)
            if (deck.mainboard && deck.mainboard.categories) {
                for (const categoryName in deck.mainboard.categories) {
                    finalCategories[categoryName] = processCardList(deck.mainboard.categories[categoryName]);
                }
            } else if (deck.categories) {
                // fallback para compatibilidade antiga
                for (const categoryName in deck.categories) {
                    finalCategories[categoryName] = processCardList(deck.categories[categoryName]);
                }
            }
            // Sideboard
            if (deck.sideboard) {
                const processedSideboard = processCardList(deck.sideboard);
                finalSideboard.push(...processedSideboard);
            }
            // Maybeboard
            if (deck.maybeboard) {
                const processedMaybeboard = processCardList(deck.maybeboard);
                finalMaybeboard.push(...processedMaybeboard);
            }

            const percentage = totalDeckCards > 0 ? (ownedCardsCount / totalDeckCards) * 100 : 0;

            if (percentage >= 70) {
                results.push({
                    name: deck.name,
                    updatedAt: deck.updatedAt,
                    percentage: percentage.toFixed(2),
                    mainboard: { categories: finalCategories },
                    sideboard: Array.isArray(finalSideboard) ? finalSideboard : [],
                    maybeboard: Array.isArray(finalMaybeboard) ? finalMaybeboard : []
                });
            }
        }
        
        const decks100 = results.filter(d => d.percentage === "100.00");
        const decks70 = results.filter(d => d.percentage < 100);

        res.status(200).json({ decks100, decks70 });

    } catch (error) {
        console.error("Erro na API /api/search:", error);
        res.status(500).json({ error: 'Failed to process decks on the server.' });
    }
}