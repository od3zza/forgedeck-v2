// lib/script.js (VERSÃO FINAL UNIFICADA)
document.addEventListener('DOMContentLoaded', () => {
    // ===================================================================
    // ETAPA 1: DECLARAÇÃO DE TODAS AS CONSTANTES DE ELEMENTOS
    // ===================================================================
    const searchButton = document.getElementById('search-button');
    const cardListInput = document.getElementById('card-list-input');
    const formatSelect = document.getElementById('format-select');
    const statusDiv = document.getElementById('status');
    const resultsContainer = document.getElementById('results-container');
    const results100Div = document.getElementById('results-100');
    const results70Div = document.getElementById('results-70');
    const donationPopup = document.getElementById('donation-popup');
    const closePopupButton = document.getElementById('close-popup-btn');

    // ===================================================================
    // ETAPA 2: LÓGICA DO POP-UP DE DOAÇÃO
    // ===================================================================
    if (donationPopup && closePopupButton) {
        // Mostra o pop-up após 3 segundos (sem usar sessionStorage)
        setTimeout(() => {
            donationPopup.classList.remove('popup-hidden');
        }, 3000);

        // Adiciona o evento de clique ao botão de fechar
        closePopupButton.addEventListener('click', () => {
            donationPopup.classList.add('popup-hidden');
        });
    }

    // ===================================================================
    // ETAPA 3: LÓGICA DO PREVIEW DE CARTAS (SCRYFALL)
    // ===================================================================
    const scryfallCache = {};
    let cardPreviewTooltip = null;

    function showCardPreview(imageUrl, x, y) {
        if (!cardPreviewTooltip) {
            cardPreviewTooltip = document.createElement('div');
            cardPreviewTooltip.className = 'card-preview-tooltip';
            document.body.appendChild(cardPreviewTooltip);
        }
        cardPreviewTooltip.innerHTML = `<img src="${imageUrl}" alt="Card Preview">`;
        cardPreviewTooltip.style.left = `${x + 20}px`;
        cardPreviewTooltip.style.top = `${y - 100}px`;
        cardPreviewTooltip.style.opacity = '1';
    }

    function hideCardPreview() {
        if (cardPreviewTooltip) {
            cardPreviewTooltip.style.opacity = '0';
        }
    }
    
    resultsContainer.addEventListener('mouseover', async (event) => {
        if (event.target.tagName === 'LI') {
            const li = event.target;
            const cardName = li.textContent.replace(/^\d+\s/, '').replace(/\s\(Faltam.*\)/, '').trim();

            if (scryfallCache[cardName]) {
                showCardPreview(scryfallCache[cardName], event.clientX, event.clientY);
            } else {
                try {
                    const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
                    if (!response.ok) return;
                    
                    const data = await response.json();
                    if (data.image_uris && data.image_uris.normal) {
                        const imageUrl = data.image_uris.normal;
                        scryfallCache[cardName] = imageUrl;
                        showCardPreview(imageUrl, event.clientX, event.clientY);
                    }
                } catch (error) {
                    console.error("Erro ao buscar no Scryfall:", error);
                }
            }
        }
    });

    resultsContainer.addEventListener('mouseout', hideCardPreview);

    // ===================================================================
    // ETAPA 4: LÓGICA PRINCIPAL DA BUSCA
    // ===================================================================
    function validateCardListInput(input) {
        // Permite linhas vazias, mas cada linha não vazia deve começar com número (opcional) e nome
        const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return false;
        const regex = /^(\d+\s+)?[\w\-,'’\.()!\/:áéíóúãõâêîôûçÁÉÍÓÚÃÕÂÊÎÔÛÇ ]+$/i;
        return lines.every(line => regex.test(line));
    }

    searchButton.addEventListener('click', async () => {
        statusDiv.innerHTML = `<div class="loading-indicator"><div class="loader"></div><span>Buscando...</span></div>`;
        resultsContainer.classList.add('hidden');
        results100Div.innerHTML = '';
        results70Div.innerHTML = '';

        const userCardsText = cardListInput.value;
        const selectedFormat = formatSelect.value;

        if (!userCardsText.trim()) {
            statusDiv.textContent = 'Por favor, insira uma lista de cartas.';
            return;
        }
        if (!validateCardListInput(userCardsText)) {
            statusDiv.textContent = 'Formato inválido. Use uma linha por carta, ex: "4 Lightning Bolt" ou "1 Island".';
            return;
        }

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardList: userCardsText, format: selectedFormat }),
            });
            if (!response.ok) {
                let errorMsg = `Erro ${response.status}: `;
                try {
                    const errorData = await response.json();
                    errorMsg += errorData.error || response.statusText;
                } catch (e) {
                    errorMsg += response.statusText;
                }
                throw new Error(errorMsg);
            }
            const { decks100, decks70 } = await response.json();
            displayResults(decks100, decks70);
        } catch (error) {
            statusDiv.textContent = `Erro: ${error.message}`;
            console.error("Erro na busca:", error);
        }
    });

    // ===================================================================
    // ETAPA 5: FUNÇÃO PARA RENDERIZAR OS RESULTADOS
    // ===================================================================
    function displayResults(decks100, decks70) {
        statusDiv.innerHTML = '';
        resultsContainer.classList.remove('hidden');

        const createDeckHTML = (deck, type) => {
            // Função para renderizar Mainboard, Sideboard e Maybeboard
            const createBoardHTML = (boardData, title) => {
                if (!boardData) return '';
                let html = '';

                // Renderiza listas simples (sideboard/maybeboard)
                if (Array.isArray(boardData)) {
                    if (boardData.length === 0) return '';
                    const totalCards = boardData.reduce((acc, card) => acc + card.quantity, 0);
                    html += `<h4 class="board-title">${title} (${totalCards})</h4>`;
                    const cardsHTML = boardData.map(card => {
                        const isMissing = card.missing > 0;
                        const missingText = isMissing ? ` (Faltam ${card.missing})` : '';
                        const missingClass = isMissing ? 'class="missing-card"' : '';
                        return `<li ${missingClass}>${card.quantity} ${card.name}${missingText}</li>`;
                    }).join('');
                    html += `<ul>${cardsHTML}</ul>`;
                    return html;
                }

                // Renderiza mainboard por categorias
                const categories = boardData.categories || {};
                const categoryOrder = ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land'];
                const sortedCategories = Object.keys(categories).sort((a, b) => {
                    const indexA = categoryOrder.indexOf(a);
                    const indexB = categoryOrder.indexOf(b);
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    return a.localeCompare(b);
                });

                for (const categoryName of sortedCategories) {
                    const cardList = categories[categoryName];
                    if (cardList && cardList.length > 0) {
                        const categoryTotal = cardList.reduce((acc, c) => acc + c.quantity, 0);
                        html += `<h4 class="board-title">${categoryName} (${categoryTotal})</h4>`;
                        const cardsHTML = cardList.map(card => {
                            const isMissing = card.missing > 0;
                            const missingText = isMissing ? ` (Faltam ${card.missing})` : '';
                            const missingClass = isMissing ? 'class="missing-card"' : '';
                            return `<li ${missingClass}>${card.quantity} ${card.name}${missingText}</li>`;
                        }).join('');
                        html += `<ul>${cardsHTML}</ul>`;
                    }
                }
                return html;
            };

            // Mainboard
            const mainboardHTML = createBoardHTML(deck.mainboard, "Mainboard");
            // Sideboard
            const sideboardHTML = createBoardHTML(deck.sideboard, "Sideboard");
            // Maybeboard
            const maybeboardHTML = createBoardHTML(deck.maybeboard, "Maybeboard");

            const metaHTML = `<div class="deck-meta"><span>Atualizado em: <strong>${deck.updatedAt || 'N/A'}</strong></span></div>`;
            const deckClass = type === 'success' ? 'deck-success' : 'deck-warning';

            return `
                <div class="deck ${deckClass}">
                    <div class="deck-header">
                        <div class="deck-header-main">
                            <div class="deck-name">${deck.name}</div>
                            ${metaHTML}
                        </div>
                        <div class="deck-percentage">Compatibilidade: ${deck.percentage}%</div>
                    </div>
                    <div class="deck-card-list hidden">
                        <div class="deck-actions">
                            <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" title="Copiar lista de cartas">
                                <path d="M5,20h14v-2H5V20z M19,9h-4V3H9v6H5l7,7L19,9z"/>
                            </svg>
                            <span class="copy-feedback-message"></span>
                        </div>
                        ${mainboardHTML}
                        ${sideboardHTML}
                        ${maybeboardHTML}
                    </div>
                </div>`;
        };

        if (decks100.length === 0) {
            results100Div.innerHTML = '<p>Nenhum deck 100% compatível encontrado.</p>';
        } else {
            decks100.sort((a, b) => a.name.localeCompare(b.name));
            results100Div.innerHTML = decks100.map(deck => createDeckHTML(deck, 'success')).join('');
        }
        
        if (decks70.length === 0) {
            results70Div.innerHTML = '<p>Nenhum deck com mais de 70% de compatibilidade encontrado.</p>';
        } else {
            decks70.sort((a, b) => b.percentage - a.percentage);
            results70Div.innerHTML = decks70.map(deck => createDeckHTML(deck, 'warning')).join('');
        }

        document.querySelectorAll('.deck-header').forEach(header => {
            header.addEventListener('click', () => {
                const cardList = header.nextElementSibling;
                cardList.classList.toggle('hidden');
            });
        });

        document.querySelectorAll('.copy-icon').forEach(icon => {
            icon.addEventListener('click', (event) => {
                event.stopPropagation();
                const deckDiv = event.target.closest('.deck');
                const cardListItems = deckDiv.querySelectorAll('.deck-card-list li');
                const feedbackSpan = deckDiv.querySelector('.copy-feedback-message');
                let deckTextToCopy = '';
                cardListItems.forEach(item => {
                    const cleanText = item.textContent.replace(/\s\(Faltam.*\)/, '');
                    deckTextToCopy += cleanText + '\n';
                });
                navigator.clipboard.writeText(deckTextToCopy.trim()).then(() => {
                    feedbackSpan.textContent = 'Copiado!';
                    feedbackSpan.style.opacity = '1';
                    setTimeout(() => {
                        feedbackSpan.style.opacity = '0';
                        setTimeout(() => feedbackSpan.textContent = '', 300);
                    }, 2000);
                }).catch(err => {
                    console.error('Erro ao copiar a lista do deck: ', err);
                });
            });
        });
    }
});