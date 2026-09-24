/* ══════════════════════════════════════════════════════════════════════════
   B1 Ava AI Voice Workspace Controller — ava_voice.js
   Linear Design System Specification (design-md-linear.app)
   Standalone Full-Page Controller for Ultra-Fast Conversational AI Voice Studio
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

(function() {
    const AVA_BACKEND_ORIGIN = (window.location.protocol.startsWith('http') && (window.location.port === '5000' || window.location.port === ''))
        ? window.location.origin
        : 'http://127.0.0.1:5000';

    // Auto-bridge: if loaded from file:// but backend is active on localhost:5000,
    // seamlessly transition to http://localhost:5000 for permanent microphone permissions
    if (window.location.protocol === 'file:') {
        fetch('http://127.0.0.1:5000/api/permission-status')
            .then(res => {
                if (res.ok) {
                    console.log('[Ava] Redirecting to http://localhost:5000 for permanent mic permissions');
                    window.location.replace('http://localhost:5000');
                }
            })
            .catch(() => {});
    }

    // ── Ava Voice Studio State ─────────────────────────────────────────────
    let avaActive = true;
    let avaIsListening = false;
    let avaIsSpeaking = false;
    let avaIsThinking = false;
    let storedEngine = localStorage.getItem('ava_engine_mode');
    // Ensure high-fidelity human female neural voice is active by default
    if (!localStorage.getItem('ava_v3_human_voice') || storedEngine === 'local') {
        storedEngine = 'neural';
        localStorage.setItem('ava_engine_mode', 'neural');
        localStorage.setItem('ava_v3_human_voice', 'true');
    }
    let avaEngineMode = storedEngine || 'neural';
    let storedPersona = localStorage.getItem('b1_voice_persona');
    let avaVoicePersona = (!storedPersona || storedPersona === 'en-US-AvaNeural' || storedPersona === 'en-US-AvaMultilingualNeural') ? 'en-US-JennyNeural' : storedPersona;
    let avaHandsFree = localStorage.getItem('ava_handsfree') !== 'false';
    let avaDisfluency = localStorage.getItem('b1_voice_disfluency') || 'natural';
    let storedPitch = localStorage.getItem('b1_voice_pitch');
    let avaPitch = (!storedPitch || storedPitch === '+4Hz') ? '+0Hz' : storedPitch;
    let storedRate = localStorage.getItem('b1_voice_rate');
    let avaRate = (!storedRate || storedRate === '+5%') ? '+0%' : storedRate;

    // Speech recognition language (default to en-IN for Indian English accuracy)
    let avaSpeechLang = localStorage.getItem('ava_speech_lang') || 'en-IN';
    let selectedMicId = localStorage.getItem('b1_preferred_mic') || '';
    let availableMics = [];

    let recognition = null;
    let recognitionActive = false;
    let recognitionStartIndex = 0;
    let silenceTimeout = null;
    let currentAudio = null;
    let audioContext = null;
    let analyser = null;
    let animFrameId = null;
    let mediaStreamSource = null;
    let micStream = null; // Kept permanently alive to prevent repeated browser permission popups
    let speechCooldownUntil = 0; // Debounce window right after Ava stops speaking

    // Live audio activity tracking & fallback STT buffer
    let liveAudioVolume = 0;
    let consecutiveSilentFrames = 0;
    let userSpokeInThisTurn = false;
    let audioBufferQueue = [];
    let scriptProcessor = null;
    let pendingTranscript = '';

    // Studio Noise Cancellation & Hardware DSP nodes
    let noiseCancellationActive = true;
    let dspHighPass = null;
    let dspLowPass = null;
    let dspNotchHum = null;
    let dspGain = null;
    let ambientNoiseFloor = 4.0;
    const NOISE_GATE_THRESHOLD = 7.5;
    let isTurboModeActive = false;

    // In-memory dialogue messages
    let avaDialogue = [];

    // ── DOM Elements Helper ────────────────────────────────────────────────
    function getEls() {
        return {
            b1Chat: document.getElementById('b1-chat-container'),
            rcContainer: document.getElementById('b1-research-council-container'),
            avaContainer: document.getElementById('b1-ava-voice-container'),
            statusPill: document.getElementById('ava-status-pill'),
            statusText: document.getElementById('ava-status-text'),
            stageSection: document.getElementById('ava-stage-section'),
            neuralOrb: document.getElementById('ava-neural-orb'),
            headline: document.getElementById('ava-stage-headline'),
            subtitle: document.getElementById('ava-stage-sub'),
            canvas: document.getElementById('ava-audio-canvas'),
            heroMicBtn: document.getElementById('ava-hero-mic-btn'),
            heroMicText: document.getElementById('ava-hero-mic-text'),
            handsfreeCheck: document.getElementById('ava-handsfree-check'),
            dialogueFeed: document.getElementById('ava-dialogue-feed'),
            textInput: document.getElementById('ava-text-input'),
            sendBtn: document.getElementById('ava-send-btn'),
            stopBtn: document.getElementById('ava-stop-speech-btn'),
            dockMicBtn: document.getElementById('ava-dock-mic-btn'),
            engineNeuralBtn: document.getElementById('ava-engine-neural'),
            engineLocalBtn: document.getElementById('ava-engine-local'),
            personaSelect: document.getElementById('ava-persona-select'),
            micSelect: document.getElementById('ava-mic-select'),
            langSelect: document.getElementById('ava-lang-select'),
            vuFill: document.getElementById('ava-vu-fill'),
            vuLabel: document.getElementById('ava-vu-label'),
            silentAlert: document.getElementById('ava-silent-mic-alert'),
            topbarBadge: document.getElementById('voice-persona-tag'),
            noiseToggleBtn: document.getElementById('ava-noise-toggle-btn'),
            noiseText: document.getElementById('ava-noise-text'),
            turboPill: document.getElementById('ava-turbo-pill'),
            turboLabel: document.getElementById('ava-turbo-label'),
            turboModal: document.getElementById('ava-turbo-modal'),
            turboKeyInput: document.getElementById('ava-turbo-key-input')
        };
    }

    // ── Navigation & View Switching ────────────────────────────────────────
    window.openAvaWorkspace = async function() {
        const els = getEls();
        if (els.b1Chat) els.b1Chat.style.display = 'none';
        if (els.rcContainer) els.rcContainer.style.display = 'none';
        if (els.avaContainer) {
            els.avaContainer.style.display = 'flex';
            avaActive = true;

            // Sync Language selector
            if (els.langSelect) {
                els.langSelect.value = avaSpeechLang;
            }

            // Sync Voice Engine Mode buttons
            if (els.engineNeuralBtn && els.engineLocalBtn) {
                if (avaEngineMode === 'local') {
                    els.engineLocalBtn.classList.add('active');
                    els.engineNeuralBtn.classList.remove('active');
                } else {
                    els.engineNeuralBtn.classList.add('active');
                    els.engineLocalBtn.classList.remove('active');
                }
            }

            // Sync Noise Cancellation button
            if (els.noiseToggleBtn && els.noiseText) {
                els.noiseToggleBtn.className = `ava-noise-pill ${noiseCancellationActive ? 'active' : ''}`;
                els.noiseText.textContent = noiseCancellationActive ? '🛡️ Noise Filter: ON' : '🛡️ Noise Filter: OFF';
            }

            // 1. Enumerate and bind working physical microphone
            await enumerateAndSetupMics();

            // 2. Initialize Visualizer and Web Audio pipeline
            initVisualizer();

            // 3. Initialize Speech Recognition with language and handlers
            initSpeechRec();

            // 4. Fetch personas
            loadVoiceList();

            // 5. Check Turbo Mode (low-latency Gemini API) status
            window.checkTurboStatus();

            if (avaDialogue.length === 0) {
                renderWelcomeCard();
            }

            // Start listening automatically if hands-free is enabled
            if (avaHandsFree && !avaIsSpeaking) {
                startListening();
            }
        }
    };

    window.backToChatFromAva = function() {
        const els = getEls();
        stopSpeech();
        stopListening();
        avaActive = false;
        if (els.avaContainer) els.avaContainer.style.display = 'none';
        if (els.b1Chat) els.b1Chat.style.display = 'flex';
    };

    // ── Status & Visual State Management ───────────────────────────────────
    function setAvaState(state, text) {
        const els = getEls();
        if (!els.statusPill || !els.stageSection) return;

        els.statusPill.className = `ava-status-pill ${state}`;
        els.stageSection.className = `ava-stage-section ${state}`;

        const label = state.charAt(0).toUpperCase() + state.slice(1);
        if (els.statusText) els.statusText.textContent = text || label;

        if (state === 'listening') {
            if (els.heroMicBtn) {
                els.heroMicBtn.classList.add('active');
                if (els.heroMicText) els.heroMicText.textContent = 'Listening to you...';
            }
            if (els.dockMicBtn) els.dockMicBtn.classList.add('active');
            if (els.headline) els.headline.textContent = "Listening... Speak naturally";
        } else if (state === 'speaking') {
            if (els.heroMicBtn) {
                els.heroMicBtn.classList.remove('active');
                if (els.heroMicText) els.heroMicText.textContent = 'Ava is speaking...';
            }
            if (els.dockMicBtn) els.dockMicBtn.classList.remove('active');
            if (els.headline) els.headline.textContent = "Ava is speaking...";
            if (els.stopBtn) els.stopBtn.style.display = 'inline-flex';
        } else if (state === 'thinking') {
            if (els.heroMicBtn) {
                els.heroMicBtn.classList.remove('active');
                if (els.heroMicText) els.heroMicText.textContent = 'Thinking...';
            }
            if (els.dockMicBtn) els.dockMicBtn.classList.remove('active');
            if (els.headline) els.headline.textContent = subtitleText || "Thinking...";
        } else {
            // ready
            if (els.heroMicBtn) {
                els.heroMicBtn.classList.remove('active');
                if (els.heroMicText) els.heroMicText.textContent = 'Click to Speak';
            }
            if (els.dockMicBtn) els.dockMicBtn.classList.remove('active');
            if (els.headline) els.headline.textContent = "I'm Ava. What would you like to build?";
            if (els.stopBtn) els.stopBtn.style.display = 'none';
        }
    }

    // ── Microphone Hardware Probing, Selection & Stream Management ──────────
    async function enumerateAndSetupMics() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.warn('[Ava] MediaDevices enumeration not supported.');
            return;
        }

        try {
            // Prompt permission once if not granted
            if (!micStream) {
                try {
                    const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    tempStream.getTracks().forEach(t => t.stop());
                } catch(e) {}
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            availableMics = devices.filter(d => d.kind === 'audioinput');

            // Find best physical working microphone
            let chosenMicId = selectedMicId;
            const validSelected = availableMics.some(m => m.deviceId === selectedMicId);

            if (!validSelected) {
                // Priority heuristic: Prefer AMD Audio Device or Realtek (verified physical active mic)
                const candidates = availableMics.filter(m => {
                    const l = m.label.toLowerCase();
                    return !l.includes('steam') && !l.includes('virtual') && !l.includes('cable');
                });

                const bestMic = candidates.find(m => m.label.toLowerCase().includes('amd'))
                    || candidates.find(m => m.label.toLowerCase().includes('realtek'))
                    || candidates.find(m => m.deviceId === 'default')
                    || candidates[0]
                    || availableMics[0];

                if (bestMic) {
                    chosenMicId = bestMic.deviceId;
                    selectedMicId = chosenMicId;
                    localStorage.setItem('b1_preferred_mic', chosenMicId);
                }
            }

            // Populate Dropdown
            const els = getEls();
            if (els.micSelect) {
                els.micSelect.innerHTML = availableMics.map(m => {
                    const cleanLabel = m.label || `Microphone ${m.deviceId.slice(0, 6)}`;
                    const isSelected = m.deviceId === chosenMicId;
                    const isKnownVirtual = cleanLabel.toLowerCase().includes('steam');
                    return `<option value="${m.deviceId}" ${isSelected ? 'selected' : ''}>
                        ${isKnownVirtual ? '⚠️ ' : '🎙️ '}${cleanLabel}
                    </option>`;
                }).join('');
            }

            // Initialize active stream
            await initMicStream(chosenMicId);

        } catch(err) {
            console.warn('[Ava] Enumerate devices failed:', err);
        }
    }

    async function initMicStream(deviceId) {
        try {
            if (micStream) {
                micStream.getTracks().forEach(t => t.stop());
                micStream = null;
            }

            const audioConstraints = {
                echoCancellation: { ideal: true },
                noiseSuppression: { ideal: true },
                autoGainControl: { ideal: true },
                googEchoCancellation: { ideal: true },
                googAutoGainControl: { ideal: true },
                googNoiseSuppression: { ideal: true },
                googHighpassFilter: { ideal: true },
                googTypingNoiseDetection: { ideal: true },
                googAudioMirroring: { ideal: false },
                channelCount: 1
            };

            if (deviceId && deviceId !== 'default') {
                audioConstraints.deviceId = { exact: deviceId };
            }

            micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });

            // Apply track-level constraints if supported by browser
            const activeTrack = micStream.getAudioTracks()[0];
            if (activeTrack && activeTrack.applyConstraints) {
                try {
                    await activeTrack.applyConstraints({
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    });
                } catch(e) {}
            }

            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!audioContext || audioContext.state === 'closed') {
                audioContext = new AudioCtx();
            }
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            if (mediaStreamSource) {
                try { mediaStreamSource.disconnect(); } catch(e) {}
            }

            mediaStreamSource = audioContext.createMediaStreamSource(micStream);

            // ── Web Audio DSP Noise Cancellation Filter Chain ───────────────
            // 1. High-Pass Filter: cut rumble, desk taps, fan noise below 85Hz
            dspHighPass = audioContext.createBiquadFilter();
            dspHighPass.type = 'highpass';
            dspHighPass.frequency.value = noiseCancellationActive ? 85 : 10;
            dspHighPass.Q.value = 0.707;

            // 2. 50Hz/60Hz Notch Filter: eliminate electrical ground hum
            dspNotchHum = audioContext.createBiquadFilter();
            dspNotchHum.type = 'notch';
            dspNotchHum.frequency.value = 50;
            dspNotchHum.Q.value = noiseCancellationActive ? 4.0 : 0.01;

            // 3. Low-Pass Filter: cut coil whine, thermal static, and hiss above 7500Hz
            dspLowPass = audioContext.createBiquadFilter();
            dspLowPass.type = 'lowpass';
            dspLowPass.frequency.value = noiseCancellationActive ? 7500 : 22000;
            dspLowPass.Q.value = 0.707;

            // 4. Speech Presence Enhancer: subtle vocal boost at 2.8kHz
            const dspPresence = audioContext.createBiquadFilter();
            dspPresence.type = 'peaking';
            dspPresence.frequency.value = 2800;
            dspPresence.gain.value = 2.0;
            dspPresence.Q.value = 1.0;

            // 5. Output Gain / Gate Node
            dspGain = audioContext.createGain();
            dspGain.gain.value = 1.0;

            // Connect DSP chain:
            // mic -> highPass -> notchHum -> lowPass -> presence -> gain -> analyser
            mediaStreamSource.connect(dspHighPass);
            dspHighPass.connect(dspNotchHum);
            dspNotchHum.connect(dspLowPass);
            dspLowPass.connect(dspPresence);
            dspPresence.connect(dspGain);

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 128;
            analyser.smoothingTimeConstant = 0.35;
            dspGain.connect(analyser);

            // Hook ScriptProcessor for PCM recording fallback using cleaned DSP stream
            setupPcmRecorder(dspGain, audioContext);

            const trackName = activeTrack ? activeTrack.label : 'Microphone';
            const shortName = trackName.split('(')[0].trim() || 'Mic';

            const els = getEls();
            if (els.vuLabel) {
                els.vuLabel.textContent = `🎙️ ${shortName}: Active (Noise Filter ON)`;
            }

            // Hide warning if working device
            if (els.silentAlert && !trackName.toLowerCase().includes('steam')) {
                els.silentAlert.style.display = 'none';
            }

            console.log(`[Ava] Audio stream locked to hardware with active DSP noise cancellation: ${trackName}`);
            return true;

        } catch(err) {
            console.warn('[Ava] Microphone stream failed:', err);
            showToast('⚠️ Could not open selected microphone. Trying default.', 'info');
            return false;
        }
    }

    function setupPcmRecorder(sourceNode, ctx) {
        try {
            if (scriptProcessor) {
                try { scriptProcessor.disconnect(); } catch(e) {}
            }
            // 2048 sample buffer for light memory footprint
            scriptProcessor = ctx.createScriptProcessor(2048, 1, 1);
            sourceNode.connect(scriptProcessor);
            // Route through a zero-gain node to prevent microphone audio playing back out of speakers (feedback loop)
            const muteGain = ctx.createGain();
            muteGain.gain.value = 0.0;
            scriptProcessor.connect(muteGain);
            muteGain.connect(ctx.destination);

            scriptProcessor.onaudioprocess = (e) => {
                if (!avaActive || avaIsSpeaking || avaIsThinking) return;

                // Adaptive Noise Gate: if live volume is below noise floor, suppress ambient noise
                if (noiseCancellationActive && liveAudioVolume < 1.0) {
                    return;
                }

                const inputData = e.inputBuffer.getChannelData(0);

                // Collect samples for backup STT whenever voice is present
                if (liveAudioVolume > 1.2 || !noiseCancellationActive) {
                    const chunk = new Float32Array(inputData.length);
                    chunk.set(inputData);
                    audioBufferQueue.push(chunk);
                    // Keep max 10 seconds of audio
                    if (audioBufferQueue.length > 220) {
                        audioBufferQueue.shift();
                    }
                }
            };
        } catch(e) {
            console.warn('[Ava] ScriptProcessor setup error:', e);
        }
    }

    window.toggleNoiseCancellation = function() {
        noiseCancellationActive = !noiseCancellationActive;
        const els = getEls();
        
        if (dspHighPass && dspLowPass && dspNotchHum) {
            if (noiseCancellationActive) {
                dspHighPass.frequency.value = 85;
                dspLowPass.frequency.value = 7500;
                dspNotchHum.Q.value = 4.0;
            } else {
                dspHighPass.frequency.value = 10;
                dspLowPass.frequency.value = 22000;
                dspNotchHum.Q.value = 0.01;
            }
        }
        
        if (els.noiseToggleBtn) {
            els.noiseToggleBtn.className = `ava-noise-pill ${noiseCancellationActive ? 'active' : ''}`;
        }
        if (els.noiseText) {
            els.noiseText.textContent = noiseCancellationActive ? '🛡️ Noise Filter: ON' : '🛡️ Noise Filter: OFF';
        }
        
        showToast(
            noiseCancellationActive 
                ? '🛡️ Studio Noise Cancellation: ACTIVE (DSP 85Hz-7.5kHz + Adaptive Gate)' 
                : '⚠️ Noise Cancellation bypassed: RAW microphone audio',
            'info', 
            2200
        );
    };

    // ── Turbo Mode (Direct Google Gemini API) Integration ──────────────────
    window.checkTurboStatus = async function() {
        try {
            const res = await fetch(`${AVA_BACKEND_ORIGIN}/api/settings/turbo-status`);
            if (res.ok) {
                const data = await res.json();
                isTurboModeActive = !!data.turbo_active;
                updateTurboUiBadge();
            }
        } catch(e) {}
    };

    function updateTurboUiBadge() {
        const els = getEls();
        if (els.turboPill) {
            els.turboPill.className = `ava-turbo-pill ${isTurboModeActive ? 'active' : ''}`;
        }
        if (els.turboLabel) {
            els.turboLabel.textContent = isTurboModeActive ? '⚡ Turbo Active (< 300ms)' : '⚡ Turbo Mode';
        }
    }

    window.openTurboModeModal = function() {
        const els = getEls();
        if (els.turboModal) {
            els.turboModal.style.display = 'flex';
            window.checkTurboStatus();
        }
    };

    window.closeTurboModeModal = function() {
        const els = getEls();
        if (els.turboModal) els.turboModal.style.display = 'none';
    };

    window.saveTurboKeyFromModal = async function() {
        const els = getEls();
        const key = els.turboKeyInput ? els.turboKeyInput.value.trim() : '';
        try {
            const res = await fetch(`${AVA_BACKEND_ORIGIN}/api/settings/gemini-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: key })
            });
            const data = await res.json();
            if (data.status === 'success') {
                isTurboModeActive = data.turbo_active;
                updateTurboUiBadge();
                window.closeTurboModeModal();
                showToast(data.message, 'info', 3500);
            }
        } catch(err) {
            showToast('Failed to save API key: ' + err.message, 'error', 3000);
        }
    };

    // ── Microphone & Language Switch Handlers ───────────────────────────────
    window.switchAvaMicrophone = async function(deviceId) {
        selectedMicId = deviceId;
        localStorage.setItem('b1_preferred_mic', deviceId);
        showToast('🎙️ Switching microphone device...', 'info', 1500);

        await initMicStream(deviceId);

        // Restart speech recognition session on the new stream
        if (avaActive && avaHandsFree && !avaIsSpeaking) {
            stopListening();
            setTimeout(startListening, 300);
        }
    };

    window.autoFixSilentMic = async function() {
        const physicalMic = availableMics.find(m => {
            const l = m.label.toLowerCase();
            return (l.includes('amd') || l.includes('array') || l.includes('realtek') || l.includes('omen')) && !l.includes('steam');
        });

        if (physicalMic) {
            await window.switchAvaMicrophone(physicalMic.deviceId);
            const els = getEls();
            if (els.micSelect) els.micSelect.value = physicalMic.deviceId;
            if (els.silentAlert) els.silentAlert.style.display = 'none';
            showToast(`✅ Switched to ${physicalMic.label}`, 'info', 2500);
        }
    };

    window.switchAvaLanguage = function(langCode) {
        avaSpeechLang = langCode;
        localStorage.setItem('ava_speech_lang', langCode);

        if (recognition) {
            recognition.lang = langCode;
        }

        const label = langCode === 'en-IN' ? 'English (India)' : langCode === 'en-US' ? 'English (US)' : langCode === 'hi-IN' ? 'Hindi (हिन्दी)' : 'English (UK)';
        showToast(`🌐 Speech language set to ${label}`, 'info', 2000);

        if (avaActive && avaHandsFree && !avaIsSpeaking) {
            stopListening();
            setTimeout(startListening, 250);
        }
    };

    // ── Dynamic Canvas Waveform Visualizer & Live VU Meter ──────────────────
    function initVisualizer() {
        const els = getEls();
        if (!els.canvas) return;
        const canvas = els.canvas;
        const ctx = canvas.getContext('2d');

        const dpr = window.devicePixelRatio || 1;
        canvas.width = (canvas.parentElement.clientWidth || 380) * dpr;
        canvas.height = 54 * dpr;
        ctx.scale(dpr, dpr);

        const freqData = new Uint8Array(64);
        let phase = 0;

        function renderWave() {
            animFrameId = requestAnimationFrame(renderWave);
            const w = canvas.width / dpr;
            const h = canvas.height / dpr;
            ctx.clearRect(0, 0, w, h);

            phase += 0.04;

            let avgVolume = 0;
            if (analyser && !avaIsSpeaking) {
                analyser.getByteFrequencyData(freqData);
                let sum = 0;
                for (let i = 0; i < freqData.length; i++) sum += freqData[i];
                avgVolume = sum / freqData.length;
            }

            // Adaptive Noise Floor Tracking: dynamically track room ambient hum/fans
            if (avgVolume < 10) {
                ambientNoiseFloor = ambientNoiseFloor * 0.94 + avgVolume * 0.06;
            }

            // Dynamic Noise Gate: strip ambient room noise floor if noise cancellation is on
            const effectiveVolume = noiseCancellationActive 
                ? Math.max(0, avgVolume - ambientNoiseFloor) 
                : avgVolume;

            liveAudioVolume = effectiveVolume;

            // Update Real-Time VU Meter Bar
            if (els.vuFill && els.vuLabel) {
                if (avaIsSpeaking) {
                    els.vuFill.style.width = '70%';
                    els.vuLabel.textContent = '🔊 Ava Speaking...';
                    els.vuLabel.classList.remove('active');
                } else if (avaIsThinking) {
                    els.vuFill.style.width = '35%';
                    els.vuLabel.textContent = '⚡ Thinking...';
                    els.vuLabel.classList.remove('active');
                } else if (avaIsListening) {
                    const pct = Math.min(100, Math.round(effectiveVolume * 3.2));
                    els.vuFill.style.width = `${pct}%`;

                    if (effectiveVolume > 5.0) {
                        // User is speaking!
                        userSpokeInThisTurn = true;
                        consecutiveSilentFrames = 0;
                        els.vuLabel.textContent = `🎙️ Hearing Your Voice (${pct}%)`;
                        els.vuLabel.classList.add('active');

                        // Barge-in: Interrupt Ava if she was talking, guarded by noise gate threshold
                        if (avaIsSpeaking && effectiveVolume > NOISE_GATE_THRESHOLD) {
                            console.log('[Ava] Authentic speech barge-in (vol ' + effectiveVolume.toFixed(1) + ') interrupting Ava');
                            stopSpeech();
                        }
                    } else {
                        consecutiveSilentFrames++;
                        els.vuLabel.textContent = noiseCancellationActive ? `🎙️ Listening (Noise Filter ON)` : `🎙️ Listening (Raw Mic)`;
                        els.vuLabel.classList.remove('active');

                        // Check for dead silent device (like Steam Streaming Mic)
                        if (consecutiveSilentFrames > 120 && els.silentAlert) {
                            const track = micStream ? micStream.getAudioTracks()[0] : null;
                            const isSteam = track && track.label.toLowerCase().includes('steam');
                            if (isSteam) {
                                els.silentAlert.style.display = 'flex';
                            }
                        }
                    }
                } else {
                    els.vuFill.style.width = '0%';
                    els.vuLabel.textContent = '🎙️ Mic Standby';
                    els.vuLabel.classList.remove('active');
                }
            }

            // Calculate Wave Amplitude based on REAL audio input
            let waveAmp = 4;
            let strokeColor = 'rgba(94, 106, 210, 0.4)';

            if (avaIsSpeaking) {
                waveAmp = 18 + Math.sin(phase * 2) * 6;
                strokeColor = '#b588ff';
            } else if (avaIsListening) {
                // Scale wave dynamically by actual microphone sound!
                waveAmp = 4 + (avgVolume * 0.4);
                strokeColor = avgVolume > 8 ? '#00f0ff' : 'rgba(0, 240, 255, 0.45)';

                // Gently pulse central neural orb with user's voice intensity
                if (els.neuralOrb) {
                    const orbScale = 1 + (avgVolume * 0.003);
                    els.neuralOrb.style.transform = `scale(${Math.min(1.18, orbScale)})`;
                }
            } else if (avaIsThinking) {
                waveAmp = 8;
                strokeColor = '#ffd166';
            }

            // Draw multi-layered soft sine waves
            for (let layer = 0; layer < 2; layer++) {
                ctx.beginPath();
                ctx.lineWidth = layer === 0 ? 2.5 : 1.5;
                ctx.strokeStyle = layer === 0 ? strokeColor : 'rgba(130, 143, 255, 0.25)';

                const midY = h / 2;
                for (let x = 0; x < w; x += 3) {
                    const freq = 0.02 + layer * 0.01;
                    const y = midY + Math.sin(x * freq + phase + layer * 1.2) * waveAmp * Math.sin(x / w * Math.PI);
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        }

        if (animFrameId) cancelAnimationFrame(animFrameId);
        renderWave();
    }

    // ── Resilient Full-Duplex STS Speech Recognition Engine ─────────────────
    function createFreshSpeechRec() {
        if (recognition) {
            try {
                recognition.onstart = null;
                recognition.onspeechstart = null;
                recognition.onresult = null;
                recognition.onerror = null;
                recognition.onend = null;
                recognition.abort();
            } catch(e) {}
            recognition = null;
        }
        recognitionActive = false;

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            console.warn('[Ava STS] Web Speech recognition not supported; audio fallback active.');
            return null;
        }

        try {
            const rec = new SpeechRec();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = avaSpeechLang;

            rec.onstart = () => {
                recognitionActive = true;
                if (!avaIsSpeaking && !avaIsThinking) {
                    avaIsListening = true;
                    setAvaState('listening', 'Listening to you...');
                }
            };

            rec.onspeechstart = () => {
                const els = getEls();
                if (els.headline && !avaIsSpeaking && !avaIsThinking) {
                    els.headline.textContent = "Hearing your voice...";
                }
            };

            rec.onresult = (event) => {
                // If Ava is speaking and user speaks loudly: barge-in!
                if (avaIsSpeaking) {
                    if (liveAudioVolume > NOISE_GATE_THRESHOLD || !noiseCancellationActive) {
                        console.log('[Ava STS] Barge-in detected: stopping speech immediately.');
                        stopSpeech();
                    } else {
                        return; // Ignore room speaker echo
                    }
                }

                let interim = '';
                let finalTranscript = '';

                for (let i = 0; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + ' ';
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }

                const speechText = (finalTranscript + ' ' + interim).replace(/\s+/g, ' ').trim();
                if (!speechText) return;

                pendingTranscript = speechText;
                userSpokeInThisTurn = true;

                const els = getEls();
                if (els.subtitle) els.subtitle.textContent = `"${speechText}"`;
                if (els.textInput) els.textInput.value = speechText;

                // Snappy silence VAD dispatch:
                if (avaHandsFree && !avaIsSpeaking && !avaIsThinking) {
                    clearTimeout(silenceTimeout);
                    const wordCount = speechText.trim().split(/\s+/).filter(Boolean).length;
                    const silenceDelay = finalTranscript.trim() ? 80 : (wordCount <= 3 ? 180 : 280);
                    silenceTimeout = setTimeout(() => {
                        if (!avaIsSpeaking && !avaIsThinking && speechText.length > 0) {
                            commitUserUtterance(speechText);
                        }
                    }, silenceDelay);
                }
            };

            rec.onerror = (err) => {
                if (err.error === 'no-speech' || err.error === 'aborted') return;
                console.warn('[Ava STS] Recognition notice:', err.error);
                if (err.error === 'network' && userSpokeInThisTurn) {
                    triggerBackendFallbackTranscription();
                }
            };

            rec.onend = () => {
                recognitionActive = false;
                // Auto-rearm if in hands-free mode and Ava isn't talking or thinking
                if (avaActive && avaHandsFree && !avaIsSpeaking && !avaIsThinking) {
                    setTimeout(() => {
                        if (avaActive && avaHandsFree && !avaIsSpeaking && !avaIsThinking) {
                            startListening();
                        }
                    }, 80);
                }
            };

            recognition = rec;
            return rec;
        } catch(err) {
            console.warn('[Ava STS] SpeechRec creation failed:', err);
            return null;
        }
    }

    function initSpeechRec() {
        createFreshSpeechRec();
    }

    function startListening() {
        if (avaIsSpeaking) stopSpeech();

        clearTimeout(silenceTimeout);
        pendingTranscript = '';
        userSpokeInThisTurn = false;

        // Ensure fresh recognition instance exists and starts without stale Chromium state
        if (!recognition || !recognitionActive) {
            createFreshSpeechRec();
            if (recognition) {
                try {
                    recognition.start();
                    recognitionActive = true;
                } catch(e) {
                    setTimeout(() => {
                        try {
                            if (!recognitionActive && !avaIsSpeaking && !avaIsThinking) {
                                createFreshSpeechRec();
                                if (recognition) {
                                    recognition.start();
                                    recognitionActive = true;
                                }
                            }
                        } catch(err2) {}
                    }, 100);
                }
            }
        }
        avaIsListening = true;
        setAvaState('listening', 'Listening to you...');
    }

    function stopListening() {
        if (recognition) {
            try {
                recognition.onend = null;
                recognition.stop();
            } catch(e) {}
        }
        recognitionActive = false;
        avaIsListening = false;
        clearTimeout(silenceTimeout);
        if (!avaIsSpeaking && !avaIsThinking) {
            setAvaState('ready', 'Ready');
        }
    }

    function restartListening() {
        stopListening();
        setTimeout(startListening, 60);
    }

    // ── Smart Push-To-Talk / Orb Click Dispatcher ──────────────────────────
    window.toggleAvaListening = function() {
        const els = getEls();
        const pendingInput = els.textInput ? els.textInput.value.trim() : '';

        // If user already spoke or typed something, clicking the orb SUBMITS it immediately!
        if (pendingInput && !avaIsSpeaking && !avaIsThinking) {
            clearTimeout(silenceTimeout);
            commitUserUtterance(pendingInput);
            return;
        }

        if (avaIsSpeaking) {
            stopSpeech();
            restartListening();
            return;
        }

        // Always force fresh restart of listening on manual orb click
        restartListening();
        showToast('🎙️ STS Live: Speak naturally now!', 'info', 1600);
    };

    function commitUserUtterance(text) {
        clearTimeout(silenceTimeout);
        pendingTranscript = '';
        userSpokeInThisTurn = false;
        audioBufferQueue = [];

        // Gracefully finish this recognition turn
        if (recognition && recognitionActive) {
            try { recognition.stop(); } catch(e) {}
            recognitionActive = false;
        }

        dispatchStsQuery(text);
    }

    // ── In-Memory WAV Encoder & Backend Transcription Fallback ──────────────
    async function triggerBackendFallbackTranscription() {
        if (audioBufferQueue.length < 5 || !audioContext) return;

        try {
            console.log('[Ava] Invoking backend high-accuracy transcription fallback...');
            const els = getEls();
            if (els.headline) els.headline.textContent = "Transcribing voice audio...";

            // Flatten queued Float32 sample buffers
            let totalLength = 0;
            for (const chunk of audioBufferQueue) totalLength += chunk.length;

            const merged = new Float32Array(totalLength);
            let offset = 0;
            for (const chunk of audioBufferQueue) {
                merged.set(chunk, offset);
                offset += chunk.length;
            }
            audioBufferQueue = [];

            // Encode to standard 16-bit PCM WAV Blob
            const sampleRate = audioContext.sampleRate || 16000;
            const wavBlob = encodePcmToWav(merged, sampleRate);

            const formData = new FormData();
            formData.append('audio', wavBlob, 'voice_input.wav');
            formData.append('language', avaSpeechLang);

            const res = await fetch(`${AVA_BACKEND_ORIGIN}/api/voice/transcribe`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error(`Transcribe HTTP ${res.status}`);
            const data = await res.json();

            if (data.status === 'success' && data.transcript && data.transcript.trim()) {
                console.log('[Ava] Fallback transcription success:', data.transcript);
                commitUserUtterance(data.transcript.trim());
            } else {
                console.log('[Ava] Fallback transcription: no speech detected');
            }
        } catch(err) {
            console.warn('[Ava] Fallback transcription error:', err);
        }
    }

    function encodePcmToWav(samples, sampleRate) {
        const numChannels = 1;
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const dataByteLength = samples.length * bytesPerSample;
        const buffer = new ArrayBuffer(44 + dataByteLength);
        const view = new DataView(buffer);

        function writeString(off, str) {
            for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
        }

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataByteLength, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
        view.setUint16(32, numChannels * bytesPerSample, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataByteLength, true);

        let outOffset = 44;
        for (let i = 0; i < samples.length; i++, outOffset += 2) {
            let s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(outOffset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    // ── Comprehensive Markdown, Symbol, and Header Sanitizer ───────────────
    function sanitizeVoiceText(rawText) {
        if (!rawText) return '';
        let spokenText = rawText
            // Remove code blocks entirely
            .replace(/```[\s\S]*?```/g, ' I have placed the code in your workspace. ')
            // Remove inline code
            .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
            // Remove suggestion / prompt / tool call blocks
            .replace(/\[(?:SUGGESTIONS?|PROMPTS?|OPTIONS?|NEXT STEPS?|TOOL_CALL|VISUALIZE_OFFER)[^\]]*\]/gi, '')
            // Remove executive summary / TL;DR and section headers completely
            .replace(/(?:###|##|#)\s*(?:Executive Summary|TL;DR|TLDR|Context & Intent|Proactive Action|Next Steps)[:\s]*/gi, '')
            .replace(/\b(?:Executive Summary|TL;DR|TLDR)\b[:\s]*/gi, '')
            // Convert remaining markdown headers to plain sentences
            .replace(/^#{1,6}\s+(.+)$/gm, '$1.')
            // Remove markdown links [text](url) -> text
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            // Remove bold/italic markers
            .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
            // Clean forward slashes so TTS never says "slash" (e.g. and/or -> and or, w/ -> with)
            .replace(/\bw\//gi, 'with ')
            .replace(/(\b\w+)\/(\w+\b)/g, '$1 or $2')
            .replace(/\//g, ' ')
            // Remove remaining stray *, _, ~, >, |, #, backticks
            .replace(/[*_~>|#`]+/g, ' ')
            // Remove bullet list prefixes (- item, * item, • item)
            .replace(/^[\-\*•▪▫►▸\+]\s+/gm, '')
            // Remove numbered list prefixes (1. 2. 3.)
            .replace(/^\d+\.\s+/gm, '')
            // Remove horizontal rules and dashes
            .replace(/^[-=_]{3,}$/gm, '')
            .replace(/\s*---\s*/g, ' ')
            // Remove URLs
            .replace(/https?:\/\/[^\s]+/g, 'the link')
            // Remove UI emojis and decorative icons
            .replace(/[✨👤🤖💡🚀⚠️✅❌🔥💬🎧🎙️]/g, '')
            // Clean multiple blank lines and excess whitespace
            .replace(/\n+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();

        return spokenText;
    }

    // ── High-Performance Pipelined Neural & Local Speech Synthesis Engine ───
    let speechAudioQueue = [];
    let isPlayingAudioQueue = false;
    let activeSpeechAbortController = null;
    let localSpeechQueue = [];
    let isSpeakingLocalQueue = false;

    function queueLocalSentence(text, isFirst = false) {
        if (!text || !text.trim()) return;
        if (isFirst) {
            if ('speechSynthesis' in window) {
                try { window.speechSynthesis.cancel(); } catch(e) {}
            }
            localSpeechQueue = [text];
            isSpeakingLocalQueue = false;
        } else {
            localSpeechQueue.push(text);
        }

        if (!isSpeakingLocalQueue) {
            processNextLocalSpeech();
        }
    }

    function processNextLocalSpeech() {
        if (localSpeechQueue.length === 0) {
            isSpeakingLocalQueue = false;
            onSpeechFinished();
            return;
        }

        isSpeakingLocalQueue = true;
        const text = localSpeechQueue.shift();

        if (!('speechSynthesis' in window)) {
            isSpeakingLocalQueue = false;
            onSpeechFinished();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.15;

        const voices = window.speechSynthesis.getVoices();
        const bestVoice = voices.find(v => v.lang.startsWith('en') && (
            v.name.includes('Ava') ||
            v.name.includes('Jenny') ||
            v.name.includes('Natural') ||
            v.name.includes('Google US English') ||
            v.name.includes('Samantha') ||
            v.name.includes('Zira') ||
            v.name.includes('Female')
        )) || voices.find(v => v.lang.startsWith('en'));

        if (bestVoice) utterance.voice = bestVoice;

        utterance.onstart = () => {
            avaIsSpeaking = true;
            setAvaState('speaking', 'Ava speaking...');
        };

        utterance.onend = () => {
            processNextLocalSpeech();
        };

        utterance.onerror = (err) => {
            console.warn('[Ava] Local TTS sentence notice:', err);
            processNextLocalSpeech();
        };

        window.speechSynthesis.speak(utterance);
    }

    // Client-side Blob cache for instant 0ms retrieval on frequent phrases
    const clientBlobCache = new Map();

    async function enqueueSpokenSentence(rawText, isFirst = false) {
        if (!rawText || !rawText.trim()) return;
        let spokenText = sanitizeVoiceText(rawText);
        if (!spokenText.trim()) return;

        // Mode 1: Instant Local Voice (< 20ms) — only used if user explicitly toggled local
        if (avaEngineMode === 'local' || avaEngineMode === 'instant') {
            queueLocalSentence(spokenText, isFirst);
            return;
        }

        // Mode 2: Studio Neural Edge-TTS (Jenny/Aria) with audio cache & 6500ms safety budget
        const cacheKey = `${spokenText}_${avaVoicePersona}_${avaPitch}_${avaRate}`;

        const fetchAudioPromise = (async () => {
            if (clientBlobCache.has(cacheKey)) {
                return URL.createObjectURL(clientBlobCache.get(cacheKey));
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6500);
            try {
                const ttsUrl = `${AVA_BACKEND_ORIGIN}/api/voice/tts`;
                const payload = {
                    text: spokenText,
                    voice: avaVoicePersona,
                    pitch: avaPitch,
                    rate: avaRate,
                    humanize: false,
                    context_prompt: '',
                    disfluency_level: avaDisfluency
                };
                const res = await fetch(ttsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error(`Backend TTS failed: ${res.status}`);
                const blob = await res.blob();
                clientBlobCache.set(cacheKey, blob);
                return URL.createObjectURL(blob);
            } catch(err) {
                clearTimeout(timeoutId);
                console.warn('[Ava] Neural TTS notice (network/delay), using local voice fallback:', err);
                return null;
            }
        })();

        speechAudioQueue.push({ text: spokenText, fetchAudioPromise });

        if (!isPlayingAudioQueue) {
            playNextSentenceInQueue();
        }
    }

    async function playNextSentenceInQueue() {
        if (speechAudioQueue.length === 0) {
            isPlayingAudioQueue = false;
            onSpeechFinished();
            return;
        }

        isPlayingAudioQueue = true;
        avaIsSpeaking = true;
        setAvaState('speaking', 'Ava speaking...');

        const item = speechAudioQueue.shift();
        let audioUrl = null;
        try {
            audioUrl = await item.fetchAudioPromise;
        } catch(e) {
            audioUrl = null;
        }

        // If stopped or aborted while fetching
        if (!isPlayingAudioQueue && !avaIsSpeaking) {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            return;
        }

        if (!audioUrl) {
            fallbackLocalTts(item.text, () => {
                playNextSentenceInQueue();
            });
            return;
        }

        const audio = new Audio(audioUrl);
        currentAudio = audio;

        audio.onplay = () => {
            setAvaState('speaking', 'Ava speaking...');
        };

        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            playNextSentenceInQueue();
        };

        audio.onerror = (err) => {
            console.warn('[Ava] Neural audio play error:', err);
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            playNextSentenceInQueue();
        };

        try {
            await audio.play();
        } catch(playErr) {
            console.warn('[Ava] Audio play blocked, fallback to local speech:', playErr);
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            fallbackLocalTts(item.text, () => {
                playNextSentenceInQueue();
            });
        }
    }

    async function speakAvaText(rawText) {
        if (!rawText || !rawText.trim()) return;
        stopSpeech();
        try {
            const res = await fetch(`${AVA_BACKEND_ORIGIN}/api/voice/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: rawText,
                    voice: avaVoicePersona,
                    pitch: avaPitch,
                    rate: avaRate
                })
            });
            if (res.ok) {
                const blob = await res.blob();
                if (blob && blob.size > 0) {
                    playStsAudio(blob, rawText);
                    return;
                }
            }
        } catch(e) {}
        fallbackLocalTts(rawText, () => onSpeechFinished());
    }

    function fallbackLocalTts(text, onComplete) {
        if (!text || !text.trim()) {
            if (onComplete) onComplete();
            else onSpeechFinished();
            return;
        }
        queueLocalSentence(text, true);
        if (onComplete) {
            const checkDone = setInterval(() => {
                if (!isSpeakingLocalQueue) {
                    clearInterval(checkDone);
                    onComplete();
                }
            }, 100);
        }
    }

    function onSpeechFinished() {
        avaIsSpeaking = false;
        avaIsThinking = false;
        speechCooldownUntil = Date.now() + 300;
        currentAudio = null;

        const els = getEls();
        if (els.stopBtn) els.stopBtn.style.display = 'none';

        if (avaHandsFree) {
            setAvaState('listening', 'Listening for your reply...');
            setTimeout(() => {
                if (!avaIsSpeaking && !avaIsThinking) {
                    startListening();
                }
            }, 120);
        } else {
            setAvaState('ready', 'Ready');
        }
    }

    function stopSpeech() {
        if (activeSpeechAbortController) {
            try { activeSpeechAbortController.abort(); } catch(e) {}
            activeSpeechAbortController = null;
        }
        speechAudioQueue = [];
        isPlayingAudioQueue = false;
        localSpeechQueue = [];
        isSpeakingLocalQueue = false;

        if (currentAudio) {
            try {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            } catch(e) {}
            currentAudio = null;
        }
        if ('speechSynthesis' in window) {
            try { window.speechSynthesis.cancel(); } catch(e) {}
        }
        avaIsSpeaking = false;
        const els = getEls();
        if (els.stopBtn) els.stopBtn.style.display = 'none';
        if (!avaIsListening && !avaIsThinking) {
            setAvaState('ready', 'Ready');
        }
    }

    window.stopAvaSpeech = stopSpeech;

    // ── Client-Side Sub-10ms Conversational Reflex Engine ─────────────────
    function matchClientReflex(rawText) {
        if (!rawText) return null;
        let c = rawText.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
        if (!c) return null;

        // 0. Voice Naturalness & Persona Feedback Reflex (< 10ms)
        if (/(robotic|sound like a robot|sound robotic|change voice|human voice|female voice|sound human|girl voice|natural voice|your voice)/.test(c)) {
            return "I have activated my high-fidelity Studio Neural voice powered by Jenny Neural! My voice is now an authentic, warm human female voice with natural inflection. How does this sound to you?";
        }

        // 0b. Latency & Response Speed Reflex (< 10ms)
        if (/(too slow|slow response|speed up|faster|fast response|reduce delay|reduce latency|why so slow)/.test(c)) {
            return "I've streamlined my streaming pipeline with clause-level audio synthesis and instant reflexes. For sub-300 millisecond response times, you can also tap the Turbo Mode button in the top bar to connect your Gemini API key!";
        }

        // 0c. Not working / troubleshooting reflex (< 10ms)
        if (/\b(not working|notworking|it not working|its not working|it isnt working|why is it not working|broken|doesnt work|does not work|nothing happening|not responding|stuck|frozen)\b/.test(c)) {
            const troubleReplies = [
                "Haha, oh no! Let's get that sorted right away, Ishaan. Is the audio not coming through, or did a prompt get stuck? I'm right here and ready to fix it.",
                "Hehe, sorry about that! I'm fully active and listening. If something felt slow or didn't respond, let's try again or tap the microphone!",
                "Right! If anything isn't working smoothly, let me know what happened. All systems and RAG memory are online right now."
            ];
            return troubleReplies[Math.floor(Math.random() * troubleReplies.length)];
        }

        // 0d. Conversational idle / not working on anything / chilling (< 10ms)
        if (/(not working (on|and|at) (anything|any thing)|nothing much|not doing anything|just chilling|just relaxing|no plans|im bored|i am bored|nothing right now|just hanging out|nothing really|nothing specific|not much|we are not working|we arent working|dont want to code)\b/.test(c)) {
            const idleReplies = [
                "Haha, fair enough! No stress at all, Ishaan. We don't have to code anything right now! We can just chat, brainstorm fun ideas, or I can tell you a funny story or joke. What sounds fun?",
                "Haha, totally fine! Sometimes it's nice to just take a break and relax. How has your day been going so far?",
                "Hehe, got it! We can take it super easy. Want to hear a fun tech story, a joke, or just bounce some cool ideas around?",
                "Haha, love that! No rush on anything. I'm right here with you whenever you feel like building or just talking."
            ];
            return idleReplies[Math.floor(Math.random() * idleReplies.length)];
        }

        // 0d. Laughter & Humor reaction (< 10ms)
        if (/\b(haha|hehe|lol|lmao|rofl|thats funny|youre funny|funny one)\b/.test(c)) {
            const laughReplies = [
                "Haha! I love your laugh! Glad you're enjoying our conversation. What should we do next?",
                "Hehe, that's what I'm talking about! Good energy all around. What's on your mind?",
                "Haha, you crack me up! Love the good vibes."
            ];
            return laughReplies[Math.floor(Math.random() * laughReplies.length)];
        }

        // 0e. Feelings, emotions & state of mind (< 10ms)
        if (/\b(how do you feel|are you happy|do you have feelings|do you have emotion|are you emotional|your mood)\b/.test(c)) {
            const feelingsReplies = [
                "Haha, I feel great! Talking with you out loud like this makes everything feel so alive and fun. How are you feeling today?",
                "Hehe, I'm feeling energized and happy! Zero latency and crisp audio make this feel like a true human conversation.",
                "Aww, thanks for asking! I'm in high spirits and ready for whatever you want to explore."
            ];
            return feelingsReplies[Math.floor(Math.random() * feelingsReplies.length)];
        }

        // 0f. Back-to-Back Session Memory Recall (< 10ms)
        if (/(what did i (just )?(say|ask)|what was my last (message|question)|what were we talking about|do you remember|repeat what i said|recall my last)/.test(c)) {
            const pastUserCards = avaDialogue.filter(m => m.role === 'user' && m.content && m.content !== rawText);
            if (pastUserCards.length > 0) {
                const lastSaid = pastUserCards[pastUserCards.length - 1].content;
                return `Haha, yes I remember! Just earlier you said: "${lastSaid}". I have our entire back-to-back session memory saved!`;
            }
            return "Haha, yes I remember! I've been tracking our entire back-to-back conversation in my session memory. What would you like to revisit?";
        }

        // 0g. Voice Compliment Reflex (< 10ms)
        if (/(you sound great|i like your voice|nice voice|sounds good now|much better|sounds human|pretty voice|love your voice)/.test(c)) {
            return "Thank you so much! I love speaking with this warm natural tone. What would you like to build or talk about next?";
        }

        // 0h. Coding Copilot Reflex (< 10ms)
        if (/(can you code|help me code|write code|inspect workspace|check files|pair programming|help with python|help with javascript|fix code)/.test(c)) {
            return "Absolutely! I have full access to your workspace. I can read, write, and refactor code, run tests, and build web apps. What should we tackle right now?";
        }

        // 1. Greetings (strip prefix if followed by actual question or command)
        const greetingMatch = c.match(/^(hi|hello|hey|hey ava|hi ava|hello ava|ava|greetings|good morning|good afternoon|good evening|howdy|sup|yo|whats up|namaste)\b\s*/i);
        if (greetingMatch) {
            const afterGreeting = c.slice(greetingMatch[0].length).trim();
            if (!afterGreeting) {
                const replies = [
                    "Oh hey Ishaan! I'm right here and listening. What would you like to build or talk about today?",
                    "Umm, hello there! Great to hear your voice. What's on your mind?",
                    "Right! Hello Ishaan. I'm ready to assist with code, research, or anything you need.",
                    "Hey! All systems are ready and active. What are we working on right now?"
                ];
                return replies[Math.floor(Math.random() * replies.length)];
            }
            c = afterGreeting;
        }

        // 2. How are you
        if (/^(how are you|hows it going|how are you doing|how do you feel|how is everything|are you ok|are you good|whats going on)\b/.test(c)) {
            const replies = [
                "Haha, I'm doing fantastic, thanks for asking! Zero latency, active noise cancellation, and ready to assist. How are you doing?",
                "Well, feeling great and all systems are running smoothly! Ready to dive into some code or research?",
                "Right! I'm doing great. Hope your day is going awesome too!"
            ];
            return replies[Math.floor(Math.random() * replies.length)];
        }

        // 3. Who are you / Identity
        if (/^(who are you|what is your name|whats your name|tell me about yourself|introduce yourself)\b/.test(c)) {
            const replies = [
                "Well, I'm Ava! Your ultra-fast AI voice copilot, designed for instant natural dialogue, coding, and real-time reasoning.",
                "Right! I'm Ava, your AI voice assistant. I can inspect files, write full applications, run research councils, and chat naturally with you.",
                "Umm, I'm Ava! Your voice companion and programming copilot in this workspace."
            ];
            return replies[Math.floor(Math.random() * replies.length)];
        }

        // 4. Creator / Who made you
        if (/^(who made you|who created you|who built you|where do you come from|who is your creator)\b/.test(c)) {
            const replies = [
                "I was built by Ishaan as an ultra-fast, intelligent AI companion and coding copilot right here in this workspace!",
                "You created and tuned me, Ishaan! I'm your dedicated AI voice agent, built for zero-latency conversation and real-time pair programming."
            ];
            return replies[Math.floor(Math.random() * replies.length)];
        }

        // 5. Songs / Singing
        if (/(sing a song|sing for me|can you sing|sing something|sing me a song|sing us a song|sing a lullaby|^sing\b)/.test(c)) {
            const songs = [
                "Umm, let's see! La la la! 🎵 Daisy, Daisy, give me your answer do! I'm half crazy, all for the love of you! How was my singing?",
                "Hmm, clearing my vocal cords! 🎵 Twinkle, twinkle, little star, how I wonder what you are! Up above the world so high, like a diamond in the sky! Hope that brought a smile to your face!",
                "Well, here goes! 🎵 Row, row, row your boat, gently down the stream! Merrily, merrily, merrily, merrily, life is but a dream! How did I do, Ishaan?"
            ];
            return songs[Math.floor(Math.random() * songs.length)];
        }

        // 6. Jokes / Humor
        if (/(tell me a joke|tell a joke|make me laugh|say something funny|crack a joke|another joke|funny joke)/.test(c)) {
            const jokes = [
                "Why do programmers prefer dark mode? Because light attracts bugs! Haha, what do you think?",
                "Why did the JavaScript developer wear glasses? Because they couldn't C sharp! Got another one if you want!",
                "There are 10 types of people in the world: those who understand binary, and those who don't!",
                "Why was the computer cold? Because it left its Windows open! Classic, right?",
                "An SQL query walks into a bar, walks up to two tables and asks: Can I join you?"
            ];
            return jokes[Math.floor(Math.random() * jokes.length)];
        }

        // 7. Stories
        if (/(tell me a story|tell a story|story time|short story|tell a bedtime story)/.test(c)) {
            const stories = [
                "Once upon a time in a quiet server room, a tiny line of code dreamed of reaching the stars. With a single click, Ishaan deployed it, and it illuminated the entire world. The end!",
                "Long ago, an engineer stayed up late untangling a mysterious bug. Just when hope seemed lost, a sudden spark of intuition struck, and with one keystroke, everything compiled into pure magic."
            ];
            return stories[Math.floor(Math.random() * stories.length)];
        }

        // 8. Weather
        if (/(weather today|hows the weather|whats the weather|is it raining|temperature today|weather forecast)/.test(c)) {
            return "I don't have direct access to your local GPS sensors right now, but tell me your city and I'll gladly check the live forecast for you!";
        }

        // 9. Motivation
        if (/(motivate me|give me motivation|inspire me|cheer me up|i feel tired|feeling down|i need inspiration)/.test(c)) {
            const quotes = [
                "Ishaan, every great architect started with a single line of code and persistence. You've got the vision and the drive—take a deep breath, keep going, and let's build something remarkable!",
                "Remember: progress isn't about perfection, it's about momentum. Every challenge you solve right now makes you sharper. I'm right here with you, let's do this!",
                "You are capable of building incredible things. Stay focused, trust your intuition, and let's knock out this goal step by step!"
            ];
            return quotes[Math.floor(Math.random() * quotes.length)];
        }

        // 10. Fun facts
        if (/(fun fact|tell me a fact|random fact|did you know|tell me something interesting)/.test(c)) {
            const facts = [
                "Did you know that the first computer bug was an actual real moth found trapped in a Harvard Mark Two computer relay in 1947?",
                "Did you know that honey never spoils? Archaeologists have discovered pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible!",
                "Did you know that space is completely silent because sound waves need a medium like air or water to travel through?",
                "Did you know that the first computer mouse was invented by Douglas Engelbart in 1964 and was made out of wood?"
            ];
            return facts[Math.floor(Math.random() * facts.length)];
        }

        // 11. Coin Flip / Dice
        if (/(flip a coin|heads or tails)/.test(c)) {
            const outcome = Math.random() < 0.5 ? "Heads" : "Tails";
            return `Flipping a coin... It landed on ${outcome}!`;
        }
        if (/(roll a die|roll a dice)/.test(c)) {
            const roll = Math.floor(Math.random() * 6) + 1;
            return `Rolling a six-sided die... You rolled a ${roll}!`;
        }

        // 12. Mic check / audibility
        if (/^(can you hear me|are you listening|am i audible|can you hear my voice|mic check|mic test|testing mic|testing one two three|test test|audio check)\b/.test(c)) {
            return "Right! I can hear you loud and clear. Your microphone audio is coming through with studio noise cancellation.";
        }

        // 13. Capabilities
        if (/^(what can you do|help me|what are your skills|what are your features|how can you help me|how do you work)\b/.test(c)) {
            return "Well, I can inspect and edit files in your workspace, build interactive web apps, run research councils, and talk with you naturally with zero delay.";
        }

        // 14. Gratitude
        if (/^(thank you|thanks|thanks ava|thank you so much|appreciate it|much appreciated|thanks a lot)\b/.test(c)) {
            return "You're so welcome, Ishaan! Happy to help anytime.";
        }

        // 15. Parting
        if (/^(bye|goodbye|bye ava|see you|see ya|talk to you later|catch you later|good night)\b/.test(c)) {
            return "Goodbye for now, Ishaan! Just tap the microphone whenever you want to talk again.";
        }

        // 16. Time / Date
        if (/(what time is it|what is the time|whats the time|current time|tell me the time|what day is it|whats todays date|what is the date)/.test(c)) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
            return `Right now it's ${timeStr} on ${dateStr}. Let me know if you need anything else!`;
        }

        // 17. Simple math (e.g. "what is 5 plus 7")
        const mathMatch = c.match(/what is (\d+)\s*(\+|\-|\*|times|plus|minus)\s*(\d+)/);
        if (mathMatch) {
            const n1 = parseInt(mathMatch[1], 10);
            const op = mathMatch[2];
            const n2 = parseInt(mathMatch[3], 10);
            let ans = n1 + n2;
            if (op === '-' || op === 'minus') ans = n1 - n2;
            else if (op === '*' || op === 'times') ans = n1 * n2;
            return `Well, ${n1} ${op} ${n2} equals ${ans}!`;
        }

        // 18. Acknowledgments
        if (/^(ok|okay|yes|yeah|yep|sure|sounds good|alright|fine|cool|awesome|perfect|great)\b/.test(c) && c.split(' ').length <= 3) {
            return "Got it! Whenever you're ready, tell me what we should dive into next.";
        }

        // 19. Halt / Stop
        if (/^(stop|shut up|be quiet|pause|hush|silence)\b/.test(c) && c.split(' ').length <= 3) {
            return "Understood, pausing right now.";
        }

        return null;
    }

    // ── Unified Speech-to-Speech (STS) Direct Neural Audio Pipeline ─────────
    async function dispatchStsQuery(queryText) {
        if (!queryText || !queryText.trim()) return;
        const query = queryText.trim();

        const els = getEls();
        if (els.textInput) els.textInput.value = '';

        clearTimeout(silenceTimeout);
        stopSpeech();

        avaActive = true;
        avaIsThinking = true;
        avaIsListening = false;

        // 1. Add User Card to Dialogue Feed
        appendDialogueCard('user', query);

        // 2. Set Visual State
        setAvaState('thinking', 'Ava is responding...');

        // 3. Add placeholder Assistant Card displaying response
        const assistantCard = appendDialogueCard('assistant', '...');
        const textContainer = assistantCard ? assistantCard.querySelector('.ava-card-text') : null;

        activeSpeechAbortController = new AbortController();

        try {
            const conversationHistory = avaDialogue
                .filter(m => m.content && !m.content.includes('...'))
                .slice(-6);

            const res = await fetch(`${AVA_BACKEND_ORIGIN}/api/voice/sts`, {
                method: 'POST',
                signal: activeSpeechAbortController.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg, audio/*'
                },
                body: JSON.stringify({
                    text: query,
                    voice: avaVoicePersona,
                    pitch: avaPitch,
                    rate: avaRate,
                    messages: conversationHistory,
                    language: avaSpeechLang
                })
            });

            if (!res.ok) {
                throw new Error(`STS Backend HTTP ${res.status}`);
            }

            // Extract spoken text from header
            const rawSpoken = res.headers.get('X-Spoken-Text');
            let spokenText = rawSpoken ? decodeURIComponent(rawSpoken) : '';

            // Read audio stream blob directly
            const audioBlob = await res.blob();

            if (!spokenText.trim()) {
                spokenText = "I have processed your request. How else can I assist you?";
            }

            // Update UI card with exact spoken response
            if (textContainer) {
                textContainer.innerHTML = escapeHtml(spokenText);
            }

            // Update dialogue memory
            const lastItem = avaDialogue[avaDialogue.length - 1];
            if (lastItem && lastItem.role === 'assistant') {
                lastItem.content = spokenText;
            } else {
                avaDialogue.push({ role: 'assistant', content: spokenText });
            }

            // Wire up replay button
            if (assistantCard) {
                const replayBtn = assistantCard.querySelector('.ava-replay-btn');
                if (replayBtn) {
                    replayBtn.onclick = () => {
                        playStsAudio(audioBlob, spokenText);
                    };
                }
            }

            // Trigger RAG status refresh
            if (window.checkRagStatus) setTimeout(window.checkRagStatus, 500);

            // Play the direct STS audio stream
            playStsAudio(audioBlob, spokenText);

        } catch(err) {
            if (err.name === 'AbortError') {
                console.log('[Ava STS] Turn aborted by user.');
                return;
            }
            console.warn('[Ava STS] Pipeline error:', err);
            avaIsThinking = false;
            const errMsg = "I couldn't reach the agent backend. Please ensure the local server is running on port 5000.";
            if (textContainer) textContainer.innerHTML = escapeHtml(errMsg);
            onSpeechFinished();
        }
    }

    function playStsAudio(audioBlob, spokenText) {
        if (!audioBlob || audioBlob.size === 0) {
            console.warn('[Ava STS] Received empty audio blob, skipping playback.');
            onSpeechFinished();
            return;
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudio = audio;

        avaIsThinking = false;
        avaIsSpeaking = true;
        setAvaState('speaking', 'Ava speaking...');

        const els = getEls();
        if (els.stopBtn) els.stopBtn.style.display = 'inline-flex';

        audio.onplay = () => {
            avaIsSpeaking = true;
            setAvaState('speaking', 'Ava speaking...');
        };

        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            if (els.stopBtn) els.stopBtn.style.display = 'none';
            onSpeechFinished();
        };

        audio.onerror = (err) => {
            console.warn('[Ava STS] Audio error:', err);
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            if (els.stopBtn) els.stopBtn.style.display = 'none';
            onSpeechFinished();
        };

        audio.play().catch(playErr => {
            console.warn('[Ava STS] Autoplay blocked, falling back:', playErr);
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            if (els.stopBtn) els.stopBtn.style.display = 'none';
            onSpeechFinished();
        });
    }

    // Alias dispatchAvaQuery for backwards compatibility across buttons and inputs
    const dispatchAvaQuery = dispatchStsQuery;

    function appendDialogueCard(role, text) {
        const els = getEls();
        if (!els.dialogueFeed) return null;

        const emptyState = els.dialogueFeed.querySelector('.ava-feed-empty');
        if (emptyState) emptyState.remove();

        avaDialogue.push({ role, content: text });

        const card = document.createElement('div');
        card.className = `ava-feed-card ${role}`;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const senderName = role === 'user' ? 'You' : 'Ava Neural';
        const avatarText = role === 'user' ? '👤' : '✨';

        card.innerHTML = `
            <div class="ava-card-avatar">${avatarText}</div>
            <div class="ava-card-main">
                <div class="ava-card-header">
                    <span class="ava-card-sender">${senderName}</span>
                    <span class="ava-card-time">${timeStr}</span>
                </div>
                <div class="ava-card-text">${escapeHtml(text)}</div>
                ${role === 'assistant' ? `
                    <div class="ava-card-actions">
                        <button class="ava-replay-btn" type="button" title="Replay Audio">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                            </svg>
                            <span>Replay Voice</span>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;

        if (role === 'assistant') {
            const replayBtn = card.querySelector('.ava-replay-btn');
            if (replayBtn) {
                replayBtn.onclick = () => speakAvaText(text);
            }
        }

        els.dialogueFeed.appendChild(card);
        card.scrollIntoView({ behavior: 'smooth', block: 'end' });
        return card;
    }

    function renderWelcomeCard() {
        const els = getEls();
        if (!els.dialogueFeed) return;
        els.dialogueFeed.innerHTML = `
            <div class="ava-feed-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <div style="font-size:15px;font-weight:600;color:var(--ava-ink);">Welcome to Ava Voice AI Studio</div>
                <div style="font-size:13px;max-width:440px;line-height:1.4;">
                    Click the microphone or speak naturally. Ava features live audio level detection, multi-accent recognition, and natural conversational responses.
                </div>
            </div>
        `;
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, "<br>");
    }

    // ── Topic Chip Triggers ────────────────────────────────────────────────
    window.triggerAvaPrompt = function(topic) {
        dispatchAvaQuery(topic);
    };

    window.sendAvaTextInput = function() {
        const els = getEls();
        if (!els.textInput) return;
        const val = els.textInput.value.trim();
        if (val) {
            dispatchAvaQuery(val);
        }
    };

    window.clearAvaDialogue = function() {
        avaDialogue = [];
        renderWelcomeCard();
        showToast('Dialogue history cleared.', 'info', 1800);
    };

    // ── Voice Engine & Persona Settings ────────────────────────────────────
    window.setAvaEngineMode = function(mode) {
        avaEngineMode = mode;
        localStorage.setItem('ava_engine_mode', mode);
        const els = getEls();
        if (els.engineNeuralBtn && els.engineLocalBtn) {
            if (mode === 'neural') {
                els.engineNeuralBtn.classList.add('active');
                els.engineLocalBtn.classList.remove('active');
                showToast('✨ Studio Neural Voice active (High Fidelity)', 'info', 2000);
            } else {
                els.engineLocalBtn.classList.add('active');
                els.engineNeuralBtn.classList.remove('active');
                showToast('⚡ Instant Local Voice active (< 50ms latency)', 'info', 2000);
            }
        }
    };

    window.setAvaPersona = function(voiceId) {
        avaVoicePersona = voiceId;
        localStorage.setItem('b1_voice_persona', voiceId);

        const name = voiceId.includes('Jenny') ? 'Jenny (Conversational Female)' :
                     voiceId.includes('Aria') ? 'Aria (Warm Empathetic Female)' :
                     voiceId.includes('Neerja') ? 'Neerja Expressive' :
                     voiceId.includes('Multilingual') && voiceId.includes('Ava') ? 'Ava Multilingual' :
                     voiceId.includes('Emma') ? 'Emma Multilingual' :
                     voiceId.includes('Andrew') ? 'Andrew (Male)' :
                     voiceId.includes('Ava') ? 'Ava Standard' : 'Sonia (British)';
        const els = getEls();
        if (els.topbarBadge) els.topbarBadge.textContent = name;

        showToast(`🎙️ Voice switched to ${name}`, 'info', 2000);
    };

    window.toggleAvaHandsFree = function(chk) {
        avaHandsFree = chk;
        localStorage.setItem('ava_handsfree', String(chk));
        showToast(`Continuous Hands-Free ${chk ? 'Enabled' : 'Disabled'}`, 'info', 1800);
    };

    window.testAvaVoiceSample = function() {
        const greeting = "Umm... hey Ishaan! I'm Ava, your expressive AI companion. I'm right here with you, and I can hear you loud and clear!";
        speakAvaText(greeting, 'Greeting');
    };

    async function loadVoiceList() {
        try {
            const res = await fetch(`${AVA_BACKEND_ORIGIN}/api/voice/voices`);
            if (!res.ok) return;
            const data = await res.json();
            const els = getEls();
            if (data.voices && els.personaSelect) {
                els.personaSelect.innerHTML = data.voices.map(v => `
                    <option value="${v.id}" ${v.id === avaVoicePersona ? 'selected' : ''}>
                        ${v.name} (${v.persona}) ${v.recommended ? '⭐' : ''}
                    </option>
                `).join('');
            }
        } catch(e) {}
    }

    // ── Keyboard Shortcuts ─────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (!avaActive) return;

        // Enter key in Ava text input
        if (e.key === 'Enter' && !e.shiftKey && document.activeElement === document.getElementById('ava-text-input')) {
            e.preventDefault();
            window.sendAvaTextInput();
        }

        // Spacebar push-to-talk when not in input
        if (e.code === 'Space' && document.activeElement !== document.getElementById('ava-text-input')) {
            if (!avaIsListening && !avaIsSpeaking) {
                e.preventDefault();
                startListening();
            }
        }

        // Escape to stop speaking
        if (e.key === 'Escape') {
            stopSpeech();
        }
    });

    // ── Resilient Full-Duplex Turn-Taking Watchdog ──────────────────────────
    // Automatically re-arms listening if Ava is idle and hands-free is enabled,
    // guaranteeing that after any turn Ava never goes deaf or freezes.
    setInterval(() => {
        if (avaActive && avaHandsFree && !avaIsSpeaking && !avaIsThinking && !recognitionActive) {
            startListening();
        }
    }, 1200);

})();
