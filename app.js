const app = document.querySelector("#app");
const menuButton = document.querySelector("#menu-button");

const categories = [
    {
        id: "asfixia",
        name: "Asfixia",
        description: "Durante la asfixia, la persona manifiesta dificultad respiratoria. Observa la escena y sus señales.",
        images: Array.from({ length: 6 }, (_, index) => `asf${index + 1}.jpg`),
        protocol: "protocolo_asfixia.jpg"
    },
    {
        id: "rcp",
        name: "RCP",
        description: "Al requerir RCP, la persona permanece inmóvil y requiere una respuesta inmediata. Observa la escena y sus señales.",
        images: Array.from({ length: 6 }, (_, index) => `rcp${index + 1}.jpg`),
        protocol: "protocolo_rcp.jpg"
    },
    {
        id: "convulsion",
        name: "Convulsiones",
        description: "Durante un episodio de convulsión, la persona y su entorno pueden requerir atención. Observa la escena y sus señales.",
        images: Array.from({ length: 6 }, (_, index) => `conv${index + 1}.jpg`),
        protocol: "protocolo_convulsion.jpg"
    }
];

const phases = {
    fase1: {
        name: "Fase 1",
        description: "Relaciona cada situación con un número y recibe retroalimentación.",
        kind: "numbers",
        feedback: true
    },
    fase2: {
        name: "Fase 2",
        description: "Practica la selección del protocolo correspondiente.",
        kind: "protocols",
        feedback: true
    },
    fase3: {
        name: "Fase 3",
        description: "Resuelve los ensayos sin señales de acierto o error.",
        kind: "protocols",
        feedback: false
    }
};

const protocols = [
    { id: "asfixia", image: "protocolo_asfixia.jpg" },
    { id: "rcp", image: "protocolo_rcp.jpg" },
    { id: "convulsion", image: "protocolo_convulsion.jpg" },
    { id: "extra", image: "protocolo_de_sobra.jpg" }
];

const instructionText = [
    "Se te presentará un estímulo muestra por <strong>15 segundos</strong>, constituido por una imagen de una <strong>situación de riesgo</strong>.",
    "Posteriormente, aparecerán <strong>cuatro estímulos comparativos</strong>, entre los cuales deberás <strong>seleccionar</strong> el que consideres que corresponde con el estímulo muestra.",
    "Si completas <strong>tres respuestas correctas consecutivas</strong>, <strong class=\"reinforcement-text\">recibirás un dulce como reforzador.</strong>",
    "Si acumulas tres <strong>respuestas incorrectas</strong>, <strong>el ensayo se reiniciará desde el principio.</strong>"
];

const soundFiles = {
    instrucciones: "instrucciones.mp3",
    reloj: "reloj.mp3",
    acierto: "acierto.mp3",
    error: "error.mp3",
    tada: "tada.mp3"
};
const sounds = Object.fromEntries(
    Object.entries(soundFiles).map(([name, file]) => [name, new Audio(`audio/${file}`)])
);

const allStimuli = categories.flatMap(category => category.images.map(image => `${category.id}/${image}`));
const shuffledNumbers = shuffle(Array.from({ length: 100 }, (_, number) => number));
const numberAnswers = new Map(allStimuli.map((image, index) => [image, shuffledNumbers[index]]));
const numberOptions = new Map(allStimuli.map(image => {
    const answer = numberAnswers.get(image);
    const distractors = shuffle(Array.from({ length: 100 }, (_, number) => number).filter(number => number !== answer)).slice(0, 3);
    return [image, [answer, ...distractors]];
}));
const storageKey = "protocolo-training-results-v1";
let results = loadResults();
let state = null;
let stimulusTimer;
let countdownTimer;
let responseTimer;
let stimulusToken = 0;

function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const otherIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
    }
    return shuffled;
}

function loadResults() {
    try {
        return JSON.parse(localStorage.getItem(storageKey)) || {};
    } catch {
        return {};
    }
}

function saveResults() {
    try {
        localStorage.setItem(storageKey, JSON.stringify(results));
    } catch {
        // The current session still shows its results if browser storage is unavailable.
    }
}

function playSound(name, loop = false) {
    const sound = sounds[name];
    sound.pause();
    sound.currentTime = 0;
    sound.loop = loop;
    sound.play().catch(() => {});
}

function stopSound(name) {
    sounds[name].pause();
    sounds[name].currentTime = 0;
    sounds[name].loop = false;
}

function stopAllSounds() {
    Object.keys(sounds).forEach(stopSound);
}

function clearTimers() {
    window.clearTimeout(stimulusTimer);
    window.clearInterval(countdownTimer);
    window.clearTimeout(responseTimer);
}

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatResponseSeconds(seconds) {
    return Number.isFinite(seconds) ? `${seconds.toFixed(1)} s` : "Sin dato";
}

function renderHome() {
    clearTimers();
    stopAllSounds();
    state = null;
    menuButton.hidden = true;
    app.innerHTML = `
        <section class="welcome-layout">
            <div class="welcome-copy">
                <h1>Protocolos de actuación ante situaciones de riesgo</h1>
            </div>
        </section>
        <section class="phase-section" aria-labelledby="phase-heading">
            <div class="section-heading">
                <div><h2 id="phase-heading">Selecciona una fase</h2></div>
            </div>
            <div class="phase-grid">
                ${Object.entries(phases).map(([id, phase], index) => `
                    <article class="phase-card">
                        <div class="phase-card-top"><span class="phase-status ${results[id] ? "is-complete" : ""}">${results[id] ? "COMPLETADA" : "DISPONIBLE"}</span></div>
                        <h3>${phase.name}</h3>
                        <p>${phase.description}</p>
                        <button class="phase-button" type="button" data-phase="${id}">${results[id] ? "Repetir fase" : "Comenzar fase"}<span aria-hidden="true">&#8594;</span></button>
                    </article>
                `).join("")}
            </div>
        </section>
        <section class="results-section" aria-labelledby="results-heading">
            <div class="section-heading">
                <div><h2 id="results-heading">Resultados</h2></div>
            </div>
            <div class="record-grid">${Object.keys(phases).map(renderRecordCard).join("")}</div>
        </section>
        <div class="reset-session-actions">
            <button class="reset-session-button" type="button" data-action="confirm-reset">Reiniciar sesión</button>
        </div>
    `;
    app.focus();
}

function renderResetConfirmation() {
    clearTimers();
    stopAllSounds();
    state = null;
    menuButton.hidden = true;
    app.innerHTML = `
        <section class="reset-confirmation" aria-labelledby="reset-heading">
            <h1 id="reset-heading">¿Estás seguro de que quieres reiniciar sesión?</h1>
            <div class="reset-confirmation-actions">
                <button class="quiet-button" type="button" data-action="cancel-reset">No</button>
                <button class="reset-yes-button" type="button" data-action="reset-session">Sí</button>
            </div>
        </section>
    `;
    app.focus();
}

function resetSession() {
    results = {};
    try {
        localStorage.removeItem(storageKey);
    } catch {
        saveResults();
    }
    renderHome();
}

function startPhaseFlow(phaseId) {
    clearTimers();
    stopAllSounds();
    state = { phaseId };
    menuButton.hidden = false;
    if (phaseId === "fase1") {
        playSound("instrucciones");
        renderInstructions();
    } else {
        beginPhase();
    }
}

function renderInstructions() {
    app.innerHTML = `
        <section class="instructions-page">
            <div class="page-kicker"><span class="phase-pill">FASE 1</span><span>ANTES DE COMENZAR</span></div>
            <div class="instructions-layout">
                <div class="instructions-copy">
                    <p class="eyebrow">presta atención a cada escena.</p>
                    <h1>INSTRUCCIONES</h1>
                    <ol class="instruction-list">${instructionText.map(text => `<li>${text}</li>`).join("")}</ol>
                    <button class="primary-button" type="button" data-action="begin">Comenzar fase <span aria-hidden="true">&#8594;</span></button>
                </div>
            </div>
        </section>
    `;
    app.focus();
}

function beginPhase() {
    stopSound("instrucciones");
    const phaseId = state.phaseId;
    state = {
        phaseId,
        categoryIndex: 0,
        itemIndex: 0,
        order: shuffle(categories[0].images),
        totalErrors: 0,
        trialErrors: 0,
        correctStreak: 0,
        completedStreaks: 0,
        categoryStartedAt: performance.now(),
        categoryDurations: {},
        responseTimes: Object.fromEntries(categories.map(category => [category.id, []])),
        trialResponseSeconds: 0,
        optionsShownAt: null,
        startedAt: performance.now(),
        locked: false
    };
    renderStimulus();
}

function currentCategory() {
    return categories[state.categoryIndex];
}

function currentImage() {
    return state.order[state.itemIndex];
}

function currentImagePath() {
    return `img/${currentCategory().id}/${currentImage()}`;
}

function gameHeader() {
    const phase = phases[state.phaseId];
    const total = categories.length * 6;
    const completed = state.categoryIndex * 6 + state.itemIndex;
    const percent = Math.round((completed / total) * 100);
    return `
        <div class="game-topline"><span class="phase-pill">${phase.name.toUpperCase()}</span><span class="game-category">Situación ${state.itemIndex + 1} de 6</span></div>
        <div class="progress-track" role="progressbar" aria-label="Progreso de la fase" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${completed}"><span style="width:${percent}%"></span></div>
    `;
}

function renderStimulus() {
    clearTimers();
    state.locked = false;
    const token = ++stimulusToken;
    app.innerHTML = `
        <section class="game-page">
            ${gameHeader()}
            <div class="stimulus-layout">
                <div class="stimulus-copy">
                    <h1>Observa la imagen</h1>
                    <div class="countdown-block"><span class="countdown-number" id="countdown">15</span><span class="countdown-label">SEGUNDOS<br>RESTANTES</span></div>
                </div>
                <div class="stimulus-visual">
                    <figure class="stimulus-image"><img src="${currentImagePath()}" alt="Situación de riesgo, escena ${state.itemIndex + 1}"></figure>
                    <p class="stimulus-description">${currentCategory().description}</p>
                </div>
            </div>
        </section>
    `;
    playSound("reloj", true);
    const startedAt = Date.now();
    countdownTimer = window.setInterval(() => {
        if (token !== stimulusToken) return;
        const remaining = Math.max(0, Math.ceil(15 - (Date.now() - startedAt) / 1000));
        const countdown = document.querySelector("#countdown");
        if (countdown) countdown.textContent = remaining;
    }, 200);
    stimulusTimer = window.setTimeout(() => {
        if (token !== stimulusToken) return;
        stopSound("reloj");
        renderChoices();
    }, 15000);
    app.focus();
}

function getOptions() {
    const phase = phases[state.phaseId];
    if (phase.kind === "numbers") {
        const image = `${currentCategory().id}/${currentImage()}`;
        const correct = numberAnswers.get(image);
        return shuffle(numberOptions.get(image)).map(number => ({ id: String(number), label: String(number), correct: number === correct }));
    }

    return shuffle(protocols.map(protocol => ({ ...protocol, correct: protocol.id === currentCategory().id })));
}

function renderChoices() {
    clearTimers();
    stopSound("reloj");
    state.locked = false;
    state.options = getOptions();
    state.optionsShownAt = performance.now();
    const phase = phases[state.phaseId];
    const isNumbers = phase.kind === "numbers";
    app.innerHTML = `
        <section class="game-page">
            ${gameHeader()}
            <div class="choice-heading"><div><p class="eyebrow">${isNumbers ? "ELIGE UNA RESPUESTA" : "SELECCIONA UNA OPCIÓN"}</p><h1>${isNumbers ? "¿Qué número corresponde?" : "¿Qué actuación corresponde?"}</h1></div></div>
            <div class="choice-grid ${isNumbers ? "number-grid" : "protocol-grid"}" aria-label="Opciones de respuesta">
                ${state.options.map((option, index) => isNumbers
                    ? `<button class="answer-option number-option" type="button" data-option="${option.id}" aria-label="Elegir número ${option.label}"><span class="number-value">${option.label}</span></button>`
                    : `<button class="answer-option protocol-option" type="button" data-option="${option.id}" aria-label="Opción ${index + 1}"><img src="img/${option.image}" alt=""></button>`
                ).join("")}
            </div>
            ${phase.feedback ? `<div class="feedback-area" id="feedback-area" aria-live="polite"><span class="streak-indicator">Respuestas correctas consecutivas <strong>${state.correctStreak} / 3</strong></span><span class="retry-indicator">Intento ${state.trialErrors + 1} de 3</span><span class="reward-message" id="reward-message"></span></div>` : `<p class="quiet-note">Esta fase no ofrece retroalimentación durante los ensayos.</p>`}
        </section>
    `;
    app.focus();
}

function chooseOption(button) {
    if (state.locked) return;
    state.locked = true;
    const phase = phases[state.phaseId];
    const selected = state.options.find(option => option.id === button.dataset.option);
    if (state.optionsShownAt !== null) {
        state.trialResponseSeconds += Math.max(0, (performance.now() - state.optionsShownAt) / 1000);
        state.optionsShownAt = null;
    }
    app.querySelectorAll(".answer-option").forEach(option => { option.disabled = true; });

    if (selected.correct) {
        saveTrialResponseTime();
        if (phase.feedback) {
            button.classList.add("is-correct");
            playSound("acierto");
        }
        state.correctStreak += 1;
        if (state.correctStreak === 3) {
            state.completedStreaks += 1;
            state.correctStreak = 0;
            if (phase.feedback) {
                const reward = document.querySelector("#reward-message");
                if (reward) reward.innerHTML = `<span class="candy-mark" aria-hidden="true"></span> ¡Dulce conseguido!`;
            }
        }
        responseTimer = window.setTimeout(advanceTrial, phase.feedback ? 1000 : 250);
        return;
    }

    state.totalErrors += 1;
    state.trialErrors += 1;
    state.correctStreak = 0;
    if (phase.feedback) {
        button.classList.add("is-wrong");
        playSound("error");
    } else {
        saveTrialResponseTime();
        responseTimer = window.setTimeout(advanceTrial, 250);
        return;
    }
    responseTimer = window.setTimeout(() => {
        if (state.trialErrors >= 3) {
            state.trialErrors = 0;
            state.trialResponseSeconds = 0;
            renderStimulus();
        } else {
            renderChoices();
        }
    }, phase.feedback ? 1000 : 250);
}

function saveTrialResponseTime() {
    const exercise = Number(currentImage().match(/\d+/)?.[0]);
    state.responseTimes[currentCategory().id].push({
        exercise,
        seconds: Number(state.trialResponseSeconds.toFixed(1))
    });
    state.trialResponseSeconds = 0;
}

function advanceTrial() {
    const category = currentCategory();
    if (state.itemIndex + 1 < state.order.length) {
        state.itemIndex += 1;
        state.trialErrors = 0;
        renderStimulus();
        return;
    }

    state.categoryDurations[category.id] = Math.max(1, Math.round((performance.now() - state.categoryStartedAt) / 1000));
    if (state.categoryIndex + 1 < categories.length) {
        state.categoryIndex += 1;
        state.itemIndex = 0;
        state.order = shuffle(categories[state.categoryIndex].images);
        state.trialErrors = 0;
        state.categoryStartedAt = performance.now();
        renderStimulus();
        return;
    }

    completePhase();
}

function completePhase() {
    clearTimers();
    stopAllSounds();
    const responseTimes = categories.flatMap(category => state.responseTimes[category.id]);
    const record = {
        phaseId: state.phaseId,
        totalErrors: state.totalErrors,
        completedStreaks: state.completedStreaks,
        categoryDurations: state.categoryDurations,
        responseTimes: state.responseTimes,
        averageResponseSeconds: responseTimes.length
            ? Number((responseTimes.reduce((total, entry) => total + entry.seconds, 0) / responseTimes.length).toFixed(1))
            : null,
        totalSeconds: Math.max(1, Math.round((performance.now() - state.startedAt) / 1000)),
        completedAt: new Date().toISOString()
    };
    results[state.phaseId] = record;
    saveResults();
    state.record = record;
    playSound("tada");
    renderCompletion();
}

function renderRecordCard(phaseId) {
    const phase = phases[phaseId];
    const record = results[phaseId];
    if (!record) {
        return `<article class="record-card record-pending"><div class="record-card-heading"><span class="phase-index">${phase.name}</span><span class="phase-status">PENDIENTE</span></div><p>Aún no hay resultados registrados.</p></article>`;
    }
    const responseDetails = categories.map(category => {
        const times = record.responseTimes?.[category.id] || [];
        const timesByExercise = new Map(times.map(entry => [entry.exercise, entry.seconds]));
        return `
            <details class="response-category">
                <summary><span>${category.name}</span><span>${times.length} de 6</span></summary>
                <dl class="response-time-list">${Array.from({ length: 6 }, (_, index) => {
                    const exercise = index + 1;
                    return `<div><dt>Ejercicio ${exercise}</dt><dd>${formatResponseSeconds(timesByExercise.get(exercise))}</dd></div>`;
                }).join("")}</dl>
            </details>
        `;
    }).join("");
    return `
        <article class="record-card">
            <div class="record-card-heading"><span class="phase-index">${phase.name}</span><span class="phase-status is-complete">COMPLETADA</span></div>
            <dl class="record-list">${categories.map(category => `<div><dt>${category.name}</dt><dd>${formatDuration(record.categoryDurations[category.id] || 0)}</dd></div>`).join("")}</dl>
            <section class="response-time-details" aria-label="Tiempos de respuesta por ejercicio">
                <h4>Tiempos de respuesta (segundos)</h4>
                ${responseDetails}
                <div class="record-average"><span>Promedio de respuesta</span><strong>${formatResponseSeconds(record.averageResponseSeconds)}</strong></div>
            </section>
            <div class="record-streak"><span>Rachas de 3 respuestas correctas</span><strong>${record.completedStreaks ?? 0}</strong></div>
            <div class="record-total"><span>Errores totales</span><strong>${record.totalErrors}</strong></div>
        </article>
    `;
}

function renderCompletion() {
    const phaseId = state.phaseId;
    const nextPhase = phaseId === "fase1" ? "fase2" : phaseId === "fase2" ? "fase3" : null;
    const isFinalPhase = phaseId === "fase3";
    app.innerHTML = `
        <section class="completion-page">
            <div class="completion-heading"><span class="completion-check" aria-hidden="true">&#10003;</span><p class="eyebrow">${isFinalPhase ? "REGISTRO DE SESIÓN" : "FASE COMPLETADA"}</p><h1>¡Bien hecho!</h1><p>${isFinalPhase ? "Este es el registro de resultados de las tres fases." : `${phases[phaseId].name} completada. Aquí tienes el registro de esta fase.`}</p></div>
            ${isFinalPhase
                ? `<div class="record-grid">${Object.keys(phases).map(renderRecordCard).join("")}</div>`
                : `<div class="single-record">${renderRecordCard(phaseId)}<p class="total-time">Tiempo total de la fase <strong>${formatDuration(results[phaseId].totalSeconds)}</strong></p></div>`
            }
            <div class="completion-actions"><button class="quiet-button" type="button" data-action="menu">Menú principal</button>${nextPhase ? `<button class="primary-button" type="button" data-phase="${nextPhase}">Siguiente fase <span aria-hidden="true">&#8594;</span></button>` : ""}</div>
        </section>
    `;
    app.focus();
}

app.addEventListener("click", event => {
    const optionButton = event.target.closest("[data-option]");
    if (optionButton) {
        chooseOption(optionButton);
        return;
    }
    const phaseButton = event.target.closest("[data-phase]");
    if (phaseButton) {
        startPhaseFlow(phaseButton.dataset.phase);
        return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    if (actionButton.dataset.action === "begin") beginPhase();
    if (actionButton.dataset.action === "menu") renderHome();
    if (actionButton.dataset.action === "confirm-reset") renderResetConfirmation();
    if (actionButton.dataset.action === "cancel-reset") renderHome();
    if (actionButton.dataset.action === "reset-session") resetSession();
});

menuButton.addEventListener("click", renderHome);
renderHome();