document.addEventListener('DOMContentLoaded', () => {
    //sa
    // =========================================================================
    // --- CONFIGURATION ---
    // =========================================================================

    // ⬇️ IMPORTANT: Replace 'YOUR_USERNAME' with your iNaturalist username.
    // const INATURALIST_USERNAME = 'jenmanley'; // Using a sample username with observations
    const INATURALIST_USERNAME = 'solomon83578'; // Using a sample username with observations
    
    // Coordinates for Bournemouth University Talbot Campus to center the map
    const BOURNEMOUTH_UNI_COORDS = [50.740, -1.895]; 

    // A pool of fun facts to be randomly assigned to species
    const FUN_FACTS_POOL = [
        "Some insects can survive being frozen solid.",
        "A single tree can absorb as much as 48 pounds of carbon dioxide per year.",
        "The oldest known living tree is over 5,000 years old.",
        "Butterflies taste with their feet.",
        "There are more microorganisms in one teaspoon of soil than there are people on earth.",
        "Some fungi create 'zombie ants' by infecting their brains.",
        "The Earth has more than 80,000 species of edible plants.",
        "Owls can't move their eyeballs.",
        "A group of flamingos is called a 'flamboyance'.",
        "Bees are found on every continent except Antarctica."
    ];


    // =========================================================================
    // --- APPLICATION STATE ---
    // =========================================================================

    let state = {
        speciesData: [],       // Holds the processed data from iNaturalist
        currentFlashcard: 0,   // Index for the flashcard view
        quizQuestions: [],     // Array of generated quiz questions
        currentQuestion: 0,    // Index for the quiz
        quizScore: 0,          // User's score in the quiz
        map: null,             // To hold the Leaflet map instance
    };


    // =========================================================================
    // --- DOM ELEMENT SELECTOR ---
    // =========================================================================

    const appContainer = document.getElementById('app-container');


    // =========================================================================
    // --- API & DATA FETCHING ---
    // =========================================================================

    /**
     * Fetches the 10 most recent observations for the configured user from iNaturalist.
     * @returns {Promise<Array>} A promise that resolves to an array of observation objects.
     */
    async function getiNaturalistData() {
        const url = `https://api.inaturalist.org/v1/observations?user_id=${INATURALIST_USERNAME}&per_page=10&order=desc&order_by=observed_on`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`iNaturalist API failed with status: ${response.status}`);
        }
        const data = await response.json();
        return data.results;
    }

    /**
     * Fetches the introductory summary of a Wikipedia page.
     * @param {string} wikiUrl - The full URL of the Wikipedia page.
     * @param {bool} complex - Weather or not to use the complex url
     * @returns {Promise<string>} A promise that resolves to the summary text.
     */
    async function getWikipediaSummary(wikiUrl, complex = false) {
        if (!wikiUrl) return "No description available.";
        
        const pageTitle = wikiUrl.split('/').pop();
        const apiUrl = `https://${complex ? `en` : `simple`}.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&explaintext=true&origin=*&titles=${pageTitle}`;
        
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Wikipedia API response not OK.');
            const data = await response.json();
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            const extract = pages[pageId].extract;
            return extract || getWikipediaSummary(wikiUrl, tru);
        } catch (error) {
            console.error("Wikipedia fetch error:", error);
            return "Could not load description.";
        }
    }


    // =========================================================================
    // --- TEMPLATES & RENDERING ---
    // =========================================================================

    /**
     * Clears the app container and renders new HTML content.
     * @param {string} html - The HTML string to render.
     */
    function render(html) {
        appContainer.innerHTML = html;
    }

    /** Displays a loading message. */
    function renderLoading() {
        render(`<div class="loading-indicator">🔬 Fetching biodiversity data...</div>`);
    }

    /** Displays an error message. */
    function renderError(message) {
        render(`<div class="error-message">😟 Oops! ${message}</div>`);
    }

    /** Renders the main menu to choose a game mode. */
    function renderMainMenu() {
        const html = `
            <div class="main-menu">
                <h2>Welcome to the BioBlitz Challenge!</h2>
                <p>Choose a mode below to start learning about and exploring campus biodiversity.</p>
                <button id="start-learning-btn" class="btn">🧠 Learning Mode</button>
                <button id="start-exploration-btn" class="btn">🧭 Exploration Mode</button>
            </div>
        `;
        render(html);
        document.getElementById('start-learning-btn').addEventListener('click', startLearningMode);
        document.getElementById('start-exploration-btn').addEventListener('click', startExplorationModeMenu);
    }

    /** Renders the flashcard interface. */
    function renderFlashcard() {
        const species = state.speciesData[state.currentFlashcard];
        const html = `
            <div class="flashcard-container">
                <div id="flashcard" class="flashcard">
                    <div class="flashcard-face flashcard-front">
                        <img src="${species.photoUrl}" alt="${species.commonName}">
                        <h2>${species.commonName}</h2>
                        <h3><em>${species.scientificName}</em></h3>
                        <button id="flip-btn" class="btn btn-secondary">Show Info</button>
                    </div>
                    <div class="flashcard-face flashcard-back">
                        <h4>Description</h4>
                        <p>${species.description}</p>
                        <h4>⭐ Fun Fact</h4>
                        <p>${species.funFact}</p>
                        <button id="flip-back-btn" class="btn btn-secondary">Show Photo</button>
                    </div>
                </div>
                <div class="flashcard-nav">
                    <button id="prev-card-btn" class="btn" ${state.currentFlashcard === 0 ? 'disabled' : ''}>Previous</button>
                    <span>${state.currentFlashcard + 1} / ${state.speciesData.length}</span>
                    <button id="next-card-btn" class="btn" ${state.currentFlashcard === state.speciesData.length - 1 ? 'disabled' : ''}>Next</button>
                </div>
                <button id="start-quiz-btn" class="btn">Ready for a Quiz!</button>
            </div>
        `;
        render(html);

        const card = document.getElementById('flashcard');
        document.getElementById('flip-btn').addEventListener('click', () => card.classList.add('is-flipped'));
        document.getElementById('flip-back-btn').addEventListener('click', () => card.classList.remove('is-flipped'));
        
        document.getElementById('prev-card-btn').addEventListener('click', () => {
            if (state.currentFlashcard > 0) {
                state.currentFlashcard--;
                renderFlashcard();
            }
        });

        document.getElementById('next-card-btn').addEventListener('click', () => {
            if (state.currentFlashcard < state.speciesData.length - 1) {
                state.currentFlashcard++;
                renderFlashcard();
            }
        });

        document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
    }
    
    /** Renders the current quiz question. */
    function renderQuizQuestion() {
        const q = state.quizQuestions[state.currentQuestion];
        const optionsHtml = q.options.map((option, index) => 
            `<button class="btn quiz-option" data-index="${index}">${option}</button>`
        ).join('');

        const html = `
            <div class="quiz-container">
                <div class="quiz-question">${q.question}</div>
                <div class="quiz-options">${optionsHtml}</div>
                <div class="quiz-progress">Question ${state.currentQuestion + 1} of ${state.quizQuestions.length} | Score: ${state.quizScore}</div>
            </div>
        `;
        render(html);

        document.querySelectorAll('.quiz-option').forEach(button => {
            button.addEventListener('click', (e) => handleQuizAnswer(e.target));
        });
    }

    /** Renders the final quiz summary. */
    function renderQuizSummary() {
        const percentage = Math.round((state.quizScore / state.quizQuestions.length) * 100);
        const html = `
            <div class="quiz-container">
                <h2>Quiz Complete!</h2>
                <p>Your final score is: <strong>${state.quizScore} out of ${state.quizQuestions.length} (${percentage}%)</strong></p>
                <button id="restart-learning-btn" class="btn">Play Again</button>
                <button id="main-menu-btn" class="btn btn-secondary">Main Menu</button>
            </div>
        `;
        render(html);
        document.getElementById('restart-learning-btn').addEventListener('click', startLearningMode);
        document.getElementById('main-menu-btn').addEventListener('click', renderMainMenu);
    }
    
    /** Renders the menu for the Exploration Mode. */
    function startExplorationModeMenu() {
        const html = `
            <div class="main-menu">
                <h2>Exploration Mode</h2>
                <p>Ready to explore? Choose your challenge.</p>
                <button id="map-challenge-btn" class="btn">🗺️ Map Challenge</button>
                <button id="field-hunt-btn" class="btn">🌿 Field Hunt</button>
                <button id="main-menu-btn" class="btn btn-secondary">Back to Main Menu</button>
            </div>
        `;
        render(html);
        document.getElementById('map-challenge-btn').addEventListener('click', renderMapChallenge);
        document.getElementById('field-hunt-btn').addEventListener('click', renderFieldHunt);
        document.getElementById('main-menu-btn').addEventListener('click', renderMainMenu);
    }
    
    /** Renders the map challenge interface. */
    function renderMapChallenge() {
        const species = state.speciesData[Math.floor(Math.random() * state.speciesData.length)];
        state.activeChallengeSpecies = species;

        const html = `
            <div>
                <h2>Map Challenge</h2>
                <p>Where on campus was the <strong>${species.commonName}</strong> observed?</p>
                <p>Click on the map to place your guess!</p>
                <div id="map"></div>
                <div id="map-result"></div>
                 <button id="exploration-menu-btn" class="btn btn-secondary">Back to Exploration Menu</button>
            </div>
        `;
        render(html);
        document.getElementById('exploration-menu-btn').addEventListener('click', startExplorationModeMenu);
        initializeMap();
    }
    
    /** Renders the field hunt interface. */
    function renderFieldHunt() {
        const species = state.speciesData[Math.floor(Math.random() * state.speciesData.length)];
        state.activeChallengeSpecies = species;

        const html = `
            <div class="field-hunt-container">
                <h2>Field Hunt</h2>
                <p>Can you find a species that matches this description?</p>
                <p class="description-box"><em>"${species.description}"</em></p>
                <p>Once you find it, log it on iNaturalist, then click the button below to check your most recent observation!</p>
                <button id="check-observation-btn" class="btn">Check My Latest iNaturalist Post</button>
                <div id="field-hunt-result"></div>
                <button id="exploration-menu-btn" class="btn btn-secondary">Back to Exploration Menu</button>
            </div>
        `;
        render(html);
        document.getElementById('check-observation-btn').addEventListener('click', checkFieldSubmission);
        document.getElementById('exploration-menu-btn').addEventListener('click', startExplorationModeMenu);
    }


    // =========================================================================
    // --- GAME LOGIC & EVENT HANDLERS ---
    // =========================================================================

    /** Initializes the Learning Mode, starting with flashcards. */
    function startLearningMode() {
        state.currentFlashcard = 0;
        state.quizScore = 0;
        state.currentQuestion = 0;
        renderFlashcard();
    }
    
    /** Starts the quiz after flashcards. */
    function startQuiz() {
        generateQuizQuestions();
        renderQuizQuestion();
    }

    /**
     * Generates a set of unique quiz questions from the species data.
     */
    function generateQuizQuestions() {
        const questions = [];
        const speciesCopy = [...state.speciesData];

        // Question Type 1: Match common name to scientific name
        for (let i = 0; i < 5; i++) {
            // Shuffle and pick a species for the question
            const correctSpecies = speciesCopy.splice(Math.floor(Math.random() * speciesCopy.length), 1)[0];
            const otherOptions = state.speciesData
                .filter(s => s.id !== correctSpecies.id)
                .sort(() => 0.5 - Math.random())
                .slice(0, 3)
                .map(s => s.scientificName);

            const options = [correctSpecies.scientificName, ...otherOptions].sort(() => 0.5 - Math.random());
            questions.push({
                question: `What is the scientific name for the <strong>${correctSpecies.commonName}</strong>?`,
                options: options,
                answer: options.indexOf(correctSpecies.scientificName)
            });
        }
        state.quizQuestions = questions;
    }

    /**
     * Handles the user's answer in the quiz, provides feedback, and moves to the next question.
     * @param {HTMLElement} selectedButton - The button element the user clicked.
     */
    function handleQuizAnswer(selectedButton) {
        const selectedIndex = parseInt(selectedButton.dataset.index);
        const question = state.quizQuestions[state.currentQuestion];

        if (selectedIndex === question.answer) {
            state.quizScore++;
            selectedButton.classList.add('correct');
        } else {
            selectedButton.classList.add('incorrect');
            // Highlight the correct answer
            document.querySelector(`.quiz-option[data-index="${question.answer}"]`).classList.add('correct');
        }

        document.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);

        setTimeout(() => {
            state.currentQuestion++;
            if (state.currentQuestion < state.quizQuestions.length) {
                renderQuizQuestion();
            } else {
                renderQuizSummary();
            }
        }, 1500);
    }
    
    /** Initializes the Leaflet map for the map challenge. */
    function initializeMap() {
        if(state.map) { state.map.remove(); }
        state.map = L.map('map').setView(BOURNEMOUTH_UNI_COORDS, 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(state.map);

        state.map.on('click', handleMapGuess);
    }

    /**
     * Handles the user's guess on the map, calculates distance, and shows the result.
     * @param {object} e - The Leaflet click event object.
     */
    function handleMapGuess(e) {
        const guessLatLng = e.latlng;
        const actualLatLng = L.latLng(state.activeChallengeSpecies.location);
        
        // Remove previous markers if any
        if (state.guessMarker) state.map.removeLayer(state.guessMarker);
        if (state.actualMarker) state.map.removeLayer(state.actualMarker);

        // Add new markers
        state.guessMarker = L.marker(guessLatLng).addTo(state.map).bindPopup("Your Guess").openPopup();
        state.actualMarker = L.marker(actualLatLng).addTo(state.map).bindPopup("Actual Location").openPopup();

        const distance = Math.round(guessLatLng.distanceTo(actualLatLng));
        
        const resultDiv = document.getElementById('map-result');
        resultDiv.innerHTML = `
            <p>You were <strong>${distance} meters</strong> away from the actual observation spot!</p>
            <button id="next-map-challenge-btn" class="btn">Try Another</button>
        `;
        
        document.getElementById('next-map-challenge-btn').addEventListener('click', renderMapChallenge);

        state.map.off('click'); // Disable further clicks
    }

    /**
     * Simulates checking the user's latest iNaturalist observation for the field hunt.
     */
    async function checkFieldSubmission() {
        const resultDiv = document.getElementById('field-hunt-result');
        resultDiv.innerHTML = `<p>Checking your latest observation...</p>`;
        
        try {
            const latestObservations = await getiNaturalistData();
            if (latestObservations.length === 0) {
                resultDiv.innerHTML = `<p>We couldn't find any recent observations for your user. Go make one!</p>`;
                return;
            }
            
            const latestObs = latestObservations[0];
            const submittedSpeciesId = latestObs.taxon.id;
            const targetSpeciesId = state.activeChallengeSpecies.id;
            
            if (submittedSpeciesId === targetSpeciesId) {
                resultDiv.innerHTML = `<p>✅ Correct! Your latest observation of a <strong>${latestObs.taxon.preferred_common_name}</strong> matches the challenge. Great job!</p>`;
            } else {
                resultDiv.innerHTML = `<p>❌ Not quite! Your latest observation was a <strong>${latestObs.taxon.preferred_common_name}</strong>, but we were looking for a <strong>${state.activeChallengeSpecies.commonName}</strong>. Cool find, though!</p>`;
            }
             resultDiv.innerHTML += `<button id="next-field-hunt-btn" class="btn">New Field Hunt</button>`;
             document.getElementById('next-field-hunt-btn').addEventListener('click', renderFieldHunt);
        } catch (error) {
            console.error("Error checking field submission:", error);
            resultDiv.innerHTML = `<p>Sorry, there was an error checking your observation.</p>`;
        }
    }


    // =========================================================================
    // --- INITIALIZATION ---
    // =========================================================================

    /** The main function to kick off the application. */
    async function init() {
        renderLoading();
        try {
            const observations = await getiNaturalistData();
            if (!observations || observations.length === 0) {
                renderError(`No observations found for user '${INATURALIST_USERNAME}'. Please check the username or add observations on iNaturalist.`);
                return;
            }

            // Process the raw API data into a more usable format
            state.speciesData = await Promise.all(observations.map(async (obs) => {
                return {
                    id: obs.taxon.id,
                    commonName: obs.taxon.preferred_common_name || 'Unknown',
                    scientificName: obs.taxon.name,
                    photoUrl: obs.photos[0]?.url.replace('square', 'medium'),
                    description: await getWikipediaSummary(obs.taxon.wikipedia_url),
                    location: obs.location.split(',').map(Number), // [lat, lng]
                    funFact: FUN_FACTS_POOL[Math.floor(Math.random() * FUN_FACTS_POOL.length)]
                };
            }));

            renderMainMenu();
        } catch (error) {
            console.error(error);
            renderError('Failed to load data. The iNaturalist API might be down or the username is incorrect.');
        }
    }

    // Start the app!
    init();

});