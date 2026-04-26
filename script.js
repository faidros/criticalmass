document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('game-board');
    const statusElement = document.getElementById('status');
    const gameModeSelect = document.getElementById('game-mode');
    const resetBtn = document.getElementById('reset-btn');
    
    const cols = 8;
    const rows = 8;
    
    // Game state
    let board = [];
    let currentPlayer = 'red'; // 'red' or 'blue'
    let isAnimating = false;
    let turnCount = 0;
    let isGameOver = false;

    // Connect UI controls
    gameModeSelect.addEventListener('change', initGame);
    resetBtn.addEventListener('click', initGame);
    
    function initGame() {
        board = Array.from({ length: rows }, () => 
            Array.from({ length: cols }, () => ({ player: null, mass: 0 }))
        );
        currentPlayer = 'red';
        isAnimating = false;
        turnCount = 0;
        isGameOver = false;
        statusElement.textContent = 'Spelare 1 (Röd) tur';
        statusElement.style.color = '#ff4d4d';
        createBoard();
    }

    // Create the game board visually
    function createBoard() {
        boardElement.innerHTML = '';
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                // Add click listener
                cell.addEventListener('click', () => handleCellClick(r, c));
                
                boardElement.appendChild(cell);
            }
        }
    }

    function handleCellClick(row, col) {
        if (isAnimating || isGameOver) return;
        
        const aiLevel = parseInt(gameModeSelect.value);
        if (currentPlayer === 'blue' && aiLevel >= 0) return; // Block human clicks when it's AI's turn

        makeMove(row, col);
    }

    function makeMove(row, col) {
        const cellState = board[row][col];
        
        // Kan bara placera i tomma rutor eller rutor man redan äger
        if (cellState.player !== null && cellState.player !== currentPlayer) {
            return false;
        }

        isAnimating = true;

        // Öka massan och sätt ägare
        cellState.player = currentPlayer;
        cellState.mass += 1;

        updateBoardVisuals();

        // Starta eventuella explosioner
        setTimeout(() => {
            processExplosions();
        }, 300);
        return true;
    }

    function getNeighbors(r, c) {
        const neighbors = [];
        if (r > 0) neighbors.push({ r: r - 1, c: c });
        if (r < rows - 1) neighbors.push({ r: r + 1, c: c });
        if (c > 0) neighbors.push({ r: r, c: c - 1 });
        if (c < cols - 1) neighbors.push({ r: r, c: c + 1 });
        return neighbors;
    }

    function processExplosions() {
        let cellsToExplode = [];
        let redCount = 0;
        let blueCount = 0;

        // Hitta alla rutor som har uppnått kritisk massa (lika många kulor som rutan har grannar)
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c].player === 'red') redCount++;
                if (board[r][c].player === 'blue') blueCount++;

                const neighbors = getNeighbors(r, c);
                if (board[r][c].mass >= neighbors.length) {
                    cellsToExplode.push({ r, c, neighbors, player: board[r][c].player });
                }
            }
        }

        // Följande check avbryter animationer i förtid om nån spelare raderats ut under kedjereaktionen.
        if ((redCount === 0 || blueCount === 0) && turnCount > 1) {
            checkWinCondition();
            return; // Stoppa loopen härifrån
        }

        if (cellsToExplode.length > 0) {
            let animationsCompleted = 0;
            let totalAnimations = 0;

            // Behandla alla explosioner
            cellsToExplode.forEach(cell => {
                const state = board[cell.r][cell.c];
                
                // Minska massan med antalet grannar (kritisk massa)
                state.mass -= cell.neighbors.length;
                if (state.mass === 0) {
                    state.player = null; // Rutan blir tom om alla kulor sprängdes iväg
                }
                
                const fromCellEl = document.querySelector(`.cell[data-row="${cell.r}"][data-col="${cell.c}"]`);
                const fromRect = fromCellEl.getBoundingClientRect();
                
                // Animera en kula som flyger till varje granne
                cell.neighbors.forEach(n => {
                    totalAnimations++;
                    const toCellEl = document.querySelector(`.cell[data-row="${n.r}"][data-col="${n.c}"]`);
                    const toRect = toCellEl.getBoundingClientRect();

                    // Skapa en flygande kula
                    const flyingOrb = document.createElement('div');
                    flyingOrb.classList.add('orb', cell.player);
                    
                    // Ställ in startposition
                    flyingOrb.style.position = 'fixed';
                    flyingOrb.style.left = `${fromRect.left + fromRect.width / 2 - 10}px`;
                    flyingOrb.style.top = `${fromRect.top + fromRect.height / 2 - 10}px`;
                    flyingOrb.style.zIndex = 100;
                    flyingOrb.style.transition = 'all 0.3s ease-in-out';
                    
                    document.body.appendChild(flyingOrb);

                    // Sätt målposition (en väldigt kort setTimeout krävs för att transition ska fungera)
                    setTimeout(() => {
                        flyingOrb.style.left = `${toRect.left + toRect.width / 2 - 10}px`;
                        flyingOrb.style.top = `${toRect.top + toRect.height / 2 - 10}px`;
                    }, 20);

                    // När animationen är klar
                    setTimeout(() => {
                        document.body.removeChild(flyingOrb); // Ta bort den flygande kulan
                        
                        // Öka massan i målcellen och ta över den
                        board[n.r][n.c].mass += 1;
                        board[n.r][n.c].player = cell.player;
                        
                        animationsCompleted++;
                        
                        // När allas animationer är klara
                        if (animationsCompleted === totalAnimations) {
                            updateBoardVisuals();
                            
                            // Let efter nya explosioner
                            setTimeout(() => {
                                processExplosions();
                            }, 50);
                        }
                    }, 320); // Måste matcha värdet i transition (0.3s) plus lite marginal
                });
            });

            // Uppdatera startrutornas utseende (att kulorna har försvunnit) med en gång medan animationen körs
            updateBoardVisuals();

        } else {
            // När ingenting längre exploderar checkar vi vinst och byter tur
            turnCount++;
            if (turnCount > 1 && checkWinCondition()) {
                return; // Spelet är över
            }

            isAnimating = false;
            currentPlayer = currentPlayer === 'red' ? 'blue' : 'red';
            
            statusElement.textContent = `Spelare ${currentPlayer === 'red' ? '1 (Röd)' : '2 (Blå)'} tur`;
            statusElement.style.color = currentPlayer === 'red' ? '#ff4d4d' : '#4d4dff';

            // Starta AI om det är blå spelares tur och en AI är vald
            const aiLevel = parseInt(gameModeSelect.value);
            if (currentPlayer === 'blue' && aiLevel >= 0 && !isGameOver) {
                setTimeout(() => playAI(aiLevel), 400); 
            }
        }
    }

    function checkWinCondition() {
        let redCount = 0;
        let blueCount = 0;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c].player === 'red') redCount++;
                if (board[r][c].player === 'blue') blueCount++;
            }
        }

        if (redCount === 0) {
            statusElement.textContent = "Spelare 2 (Blå) vinner!";
            statusElement.style.color = '#4d4dff';
            isGameOver = true; 
            isAnimating = true; // Blockerar fler klick
            return true;
        } else if (blueCount === 0) {
            statusElement.textContent = "Spelare 1 (Röd) vinner!";
            statusElement.style.color = '#ff4d4d';
            isGameOver = true; 
            isAnimating = true; // Blockerar fler klick
            return true;
        }

        return false;
    }

    function getValidMoves(stateBoard, player) {
        const moves = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (stateBoard[r][c].player === null || stateBoard[r][c].player === player) {
                    moves.push({ r, c });
                }
            }
        }
        return moves;
    }

    function isCorner(r, c) {
        return (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1);
    }

    function isEdge(r, c) {
        return r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
    }

    // AI simulation function (kopierar brädet array och spelar draget utan animation)
    function simulateMove(testBoard, r, c, player) {
        // Deep copy board
        let sim = testBoard.map(row => row.map(cell => ({ ...cell })));
        
        sim[r][c].player = player;
        sim[r][c].mass += 1;

        let explodes = true;
        let iterations = 0;
        while (explodes && iterations < 1000) {
            iterations++;
            explodes = false;
            let cellsToExplode = [];
            
            let redCount = 0;
            let blueCount = 0;

            for (let ir = 0; ir < rows; ir++) {
                for (let ic = 0; ic < cols; ic++) {
                    if (sim[ir][ic].player === 'red') redCount++;
                    if (sim[ir][ic].player === 'blue') blueCount++;

                    const neighbors = getNeighbors(ir, ic); // Samma funktion som används vanligtvis
                    if (sim[ir][ic].mass >= neighbors.length) {
                        cellsToExplode.push({ r: ir, c: ic, neighbors, player: sim[ir][ic].player });
                    }
                }
            }

            // Vid en massiv kedjereaktion vinner man när den andres färger har raderats helt.
            // Simuleraren behöver alltså inte fortsätta räkna på massans fysik därefter,
            // det skulle annars kunna skapa oändliga loopar i datorns hjärna!
            if (redCount === 0 || blueCount === 0) {
                break;
            }

            if (cellsToExplode.length > 0) {
                explodes = true;
                cellsToExplode.forEach(cell => {
                    let state = sim[cell.r][cell.c];
                    state.mass -= cell.neighbors.length;
                    if (state.mass === 0) state.player = null;

                    cell.neighbors.forEach(n => {
                        sim[n.r][n.c].mass += 1;
                        sim[n.r][n.c].player = cell.player;
                    });
                });
            }
        }
        return sim;
    }

    function playAI(level) {
        const validMoves = getValidMoves(board, 'blue');
        if (validMoves.length === 0) return;

        let chosenMove = null;

        if (level === 0) {
            // Level 0: Slumpmässigt drag
            chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        } 
        else if (level >= 1) {
            // Analysera alla möjliga drag
            const scoredMoves = validMoves.map(move => {
                let score = 0;

                // Level 4: Strategisk expert - hotanalys och positionsvärdering
                if (level === 4) {
                    const simBoard = simulateMove(board, move.r, move.c, 'blue');
                    let blueScore = 0;
                    let redScore = 0;
                    let bCount = 0;
                    let rCount = 0;

                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            const cell = simBoard[r][c];
                            if (cell.player === null) continue;

                            const capacity = getNeighbors(r, c).length;
                            const isCritical = cell.mass === capacity - 1;

                            let val = cell.mass * 10;
                            if (isCorner(r, c)) val += 50;
                            else if (isEdge(r, c)) val += 20;
                            if (isCritical) val += 30; // Tickande bomber (kritiska rutor) är bra att äga

                            if (cell.player === 'blue') {
                                bCount++;
                                blueScore += val;
                                
                                // Hotanalys: Kolla om vi riskerar att sprängas av röd
                                getNeighbors(r, c).forEach(n => {
                                    const nCell = simBoard[n.r][n.c];
                                    const nCap = getNeighbors(n.r, n.c).length;
                                    // Om en röd ruta som gränsar till oss har uppnått sin bristningsgräns minskar vi score enormt
                                    if (nCell.player === 'red' && nCell.mass === nCap - 1) {
                                        blueScore -= 80; 
                                    }
                                });
                            } else if (cell.player === 'red') {
                                rCount++;
                                redScore += val;
                            }
                        }
                    }

                    if (rCount === 0) score = 100000; // Omedelbar vinst
                    else if (bCount === 0) score = -100000; // Omedelbar förlust
                    else score = blueScore - redScore; 

                } else {
                    // Grundvärde utifrån position för AI level 1-3
                    if (isCorner(move.r, move.c)) score += 10;
                    else if (isEdge(move.r, move.c)) score += 5;

                    // För Level 2 och 3, simulera dragets framtid
                    if (level >= 2) {
                        const simBoard = simulateMove(board, move.r, move.c, 'blue');
                        
                        // Kolla om vi förlorade några av våra hörn (Straff i Level 2+)
                        getValidMoves(board, 'blue').forEach(orig => {
                            if (isCorner(orig.r, orig.c) && simBoard[orig.r][orig.c].player !== 'blue') {
                                score -= 100; // Vi förlorade ett hörn! Det undviker vi!
                            }
                        });

                        // Bonus: Tog vi motståndarens hörn? (Aggressiv belöning, Level 3)
                        if (level === 3) {
                            getValidMoves(board, 'red').forEach(orig => {
                                if (isCorner(orig.r, orig.c) && simBoard[orig.r][orig.c].player === 'blue') {
                                    score += 50; 
                                }
                                if (isEdge(orig.r, orig.c) && simBoard[orig.r][orig.c].player === 'blue') {
                                    score += 10;
                                }
                            });
                            
                            // Liten bonus för att tvinga fram explosioner oavsett utgång
                            for (let ir = 0; ir < rows; ir++) {
                                for (let ic = 0; ic < cols; ic++) {
                                    if (simBoard[ir][ic].mass === 0) score += 1; // Saker flyttade på sig
                                }
                            }
                        }
                    }
                } // Stänger if(level === 4) vs else-blocket

                // Slumpmässigt "brus" så datorn inte alltid gör exakt samma val vid lika poäng
                score += Math.random(); 

                return { move, score };
            });

            // Sortera efter högst poäng
            scoredMoves.sort((a, b) => b.score - a.score);
            chosenMove = scoredMoves[0].move;
        }

        makeMove(chosenMove.r, chosenMove.c);
    }

    function updateBoardVisuals() {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cellElement = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                const cellState = board[r][c];
                
                cellElement.innerHTML = ''; // Rensa rutan
                
                // Rita ut kulorna
                for (let i = 0; i < cellState.mass; i++) {
                    const orb = document.createElement('div');
                    orb.classList.add('orb', cellState.player);
                    
                    // Liten förskjutning så att vi ser när det ligger flera kulor i samma ruta
                    orb.style.transform = `translate(${i * 6 - 6}px, ${i * 6 - 6}px)`;
                    cellElement.appendChild(orb);
                }
            }
        }
    }

    // Initialize the game
    initGame();
});