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
    let avaActive = false;
    let avaIsListening = false;
    let avaIsSpeaking = false;
    let avaIsThinking = false;
    let storedEngine = localStorage.getItem('ava_engine_mode');
    let avaEngineMode = storedEngine || 'neural';
    let storedPersona = localStorage.getItem('b1_voice_persona');
    let avaVoicePersona = (!storedPersona || storedPersona === 'en-US-AvaNeural') ? 'en-US-AvaMultilingualNeural' : storedPersona;
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
            if (els.headline) els.headline.textContent = "Synthesizing response...";
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
            scriptProcessor.connect(ctx.destination);

            scriptProcessor.onaudioprocess = (e) => {
                if (!avaActive || avaIsSpeaking || avaIsThinking) return;

                // Adaptive Noise Gate: if live volume is below noise threshold, suppress ambient noise
                if (noiseCancellationActive && liveAudioVolume < 4.0) {
                    return;
                }

                const inputData = e.inputBuffer.getChannelData(0);

                // If user is actively speaking (liveAudioVolume > 5.5), collect samples for backup STT
                if (liveAudioVolume > 5.5) {
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

    // ── Resilient Dual Speech Recognition Engine ────────────────────────────
    function initSpeechRec() {
        if (recognition) {
            recognition.lang = avaSpeechLang;
            return;
        }

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            console.warn('[Ava] Browser Web Speech recognition not supported; fallback STT active.');
            return;
        }

        try {
            recognition = new SpeechRec();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = avaSpeechLang;

            recognition.onstart = () => {
                recognitionActive = true;
                if (!avaIsSpeaking && !avaIsThinking) {
                    avaIsListening = true;
                    setAvaState('listening', 'Listening to you...');
                }
            };

            recognition.onspeechstart = () => {
                const els = getEls();
                if (els.headline && !avaIsSpeaking && !avaIsThinking) {
                    els.headline.textContent = "Hearing your voice...";
                }
            };

            recognition.onresult = (event) => {
                // Instant Barge-In: If user speaks while Ava is speaking, interrupt audio immediately if above noise gate
                if (avaIsSpeaking) {
                    if (liveAudioVolume > NOISE_GATE_THRESHOLD || !noiseCancellationActive) {
                        console.log('[Ava] User barge-in detected (volume: ' + liveAudioVolume.toFixed(1) + '): halting speech playback immediately.');
                        stopSpeech();
                    } else {
                        // Ambient typing or room noise below threshold: ignore
                        return;
                    }
                }

                let interim = '';
                let finalTranscript = '';

                // Extract across all result slots for complete sentence capture
                for (let i = 0; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + ' ';
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }

                const speechText = (finalTranscript || interim).trim();
                if (!speechText) return;

                pendingTranscript = speechText;
                userSpokeInThisTurn = true;

                const els = getEls();
                if (els.subtitle) {
                    els.subtitle.textContent = `"${speechText}"`;
                }
                if (els.textInput) {
                    els.textInput.value = speechText;
                }

                // Snappy silence VAD dispatch: Instant response on short phrases ("hi ava", "hello")
                if (avaHandsFree && !avaIsSpeaking && !avaIsThinking) {
                    clearTimeout(silenceTimeout);
                    const wordCount = speechText.trim().split(/\s+/).filter(Boolean).length;
                    const silenceDelay = (finalTranscript.trim() && wordCount <= 6) ? 120 : (wordCount <= 4 ? 260 : 380);
                    silenceTimeout = setTimeout(() => {
                        if (!avaIsSpeaking && !avaIsThinking && speechText.length > 0) {
                            commitUserUtterance(speechText);
                        }
                    }, silenceDelay);
                }
            };

            recognition.onerror = (err) => {
                // Aborted or no-speech are normal events during pause — do NOT kill listening
                if (err.error === 'no-speech' || err.error === 'aborted') {
                    return;
                }

                if (err.error === 'not-allowed') {
                    showToast('🔒 Microphone permission blocked. Click lock icon in browser URL bar to allow.', 'info', 4500);
                    return;
                }

                console.warn('[Ava] Recognition notice:', err.error);

                // If Google cloud STT drops with network error, backend fallback handles recorded WAV
                if (err.error === 'network' && userSpokeInThisTurn) {
                    triggerBackendFallbackTranscription();
                }
            };

            recognition.onend = () => {
                recognitionActive = false;

                // If user spoke into the mic but Web Speech gave no transcript (or aborted):
                // Trigger backend WAV transcription automatically!
                if (userSpokeInThisTurn && !pendingTranscript.trim() && audioBufferQueue.length > 10) {
                    triggerBackendFallbackTranscription();
                }

                // Auto-restart recognition seamlessly
                if (avaActive && avaHandsFree && !avaIsSpeaking && !avaIsThinking) {
                    setTimeout(() => {
                        if (avaActive && !recognitionActive && !avaIsSpeaking && !avaIsThinking) {
                            try {
                                recognition.start();
                                recognitionActive = true;
                            } catch(e) {}
                        }
                    }, 150);
                } else if (!avaIsSpeaking && !avaIsThinking) {
                    avaIsListening = false;
                    setAvaState('ready', 'Ready');
                }
            };
        } catch(err) {
            console.warn('[Ava] Speech recognition init exception:', err);
        }
    }

    function startListening() {
        initSpeechRec();
        if (avaIsSpeaking) stopSpeech();

        try {
            if (recognition && !recognitionActive) {
                recognition.start();
                recognitionActive = true;
            }
            avaIsListening = true;
            userSpokeInThisTurn = false;
            pendingTranscript = '';
            setAvaState('listening', 'Listening to you...');
        } catch(e) {
            // Already started or busy
            avaIsListening = true;
            setAvaState('listening', 'Listening to you...');
        }
    }

    function stopListening() {
        if (recognition && recognitionActive) {
            try {
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

        // If already listening, DO NOT abort! Inform user to speak now
        if (avaIsListening) {
            showToast('🎙️ Ava is listening — speak your request now!', 'info', 1800);
            if (els.headline) els.headline.textContent = "Listening... Speak naturally";
        } else {
            startListening();
        }
    };

    function commitUserUtterance(text) {
        clearTimeout(silenceTimeout);
        pendingTranscript = '';
        userSpokeInThisTurn = false;
        audioBufferQueue = [];

        dispatchAvaQuery(text);
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

    // ── High-Performance Pipelined Neural Speech Synthesis Engine ──────────
    let speechAudioQueue = [];
    let isPlayingAudioQueue = false;
    let activeSpeechAbortController = null;

    async function enqueueSpokenSentence(rawText, isFirst = false) {
        if (!rawText || !rawText.trim()) return;
        let spokenText = sanitizeVoiceText(rawText);
        if (!spokenText.trim()) return;

        // Mode 1: Instant Local Voice (< 50ms)
        if (avaEngineMode === 'local') {
            queueLocalSentence(spokenText);
            return;
        }

        // Mode 2: Neural Edge-TTS via backend
        const fetchAudioPromise = (async () => {
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
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error(`Backend TTS failed: ${res.status}`);
                const blob = await res.blob();
                return URL.createObjectURL(blob);
            } catch(err) {
                console.warn('[Ava] Neural TTS error for sentence, fallback to local voice:', err);
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
        enqueueSpokenSentence(rawText, true);
    }

    function queueLocalSentence(text) {
        fallbackLocalTts(text);
    }

    function fallbackLocalTts(text, onComplete) {
        if (!('speechSynthesis' in window)) {
            if (onComplete) onComplete();
            else onSpeechFinished();
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.15;

        const voices = window.speechSynthesis.getVoices();
        const femaleVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Google US English') || v.name.includes('Natural')));
        if (femaleVoice) utterance.voice = femaleVoice;

        utterance.onstart = () => {
            avaIsSpeaking = true;
            setAvaState('speaking', 'Ava speaking...');
        };

        utterance.onend = () => {
            if (onComplete) onComplete();
            else onSpeechFinished();
        };

        utterance.onerror = () => {
            if (onComplete) onComplete();
            else onSpeechFinished();
        };

        window.speechSynthesis.speak(utterance);
    }

    function onSpeechFinished() {
        avaIsSpeaking = false;
        speechCooldownUntil = Date.now() + 400; // 400ms safety window against speaker reverberation
        currentAudio = null;

        if (avaActive && avaHandsFree) {
            setAvaState('listening', 'Listening for your reply...');
            if (!recognitionActive) {
                startListening();
            }
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

    // ── Dialogue Feed & Gemini Query Dispatcher with Sentence Streaming ───
    async function dispatchAvaQuery(queryText) {
        if (!queryText || !queryText.trim()) return;
        const query = queryText.trim();

        const els = getEls();
        if (els.textInput) els.textInput.value = '';

        clearTimeout(silenceTimeout);
        stopSpeech();

        avaIsThinking = true;
        setAvaState('thinking', 'Synthesizing response...');

        // 1. Add User Card to Feed
        appendDialogueCard('user', query);

        // 2. Add placeholder Assistant Card for live streaming
        const assistantCard = appendDialogueCard('assistant', 'Synthesizing response...');
        const textContainer = assistantCard ? assistantCard.querySelector('.ava-card-text') : null;

        activeSpeechAbortController = new AbortController();

        try {
            const conversationHistory = avaDialogue.filter(m => m.content !== 'Synthesizing response...').slice(-6);

            const res = await fetch(`${AVA_BACKEND_ORIGIN}/api/chat`, {
                method: 'POST',
                signal: activeSpeechAbortController.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        ...conversationHistory,
                        { role: 'user', content: query }
                    ],
                    model: 'gemini-3.8-flash',
                    stream: true,
                    voice_mode: true
                })
            });

            if (!res.ok) throw new Error(`Backend error ${res.status}`);

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let accumulatedText = '';
            let sentenceBuffer = '';
            let sentFirstSentence = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                let isDoneReceived = false;

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    if (line === 'data: [DONE]') {
                        isDoneReceived = true;
                        break;
                    }
                    try {
                        const json = JSON.parse(line.slice(6));
                        if (json.content) {
                            accumulatedText += json.content;
                            sentenceBuffer += json.content;
                            if (textContainer) {
                                textContainer.innerHTML = escapeHtml(accumulatedText);
                            }

                            // Detect sentence boundary (. ! ? followed by space or newline)
                            const match = sentenceBuffer.match(/^([\s\S]+?[.!?])(?:\s+|$)([\s\S]*)$/);
                            if (match) {
                                const sentence = match[1].trim();
                                sentenceBuffer = match[2] || '';
                                if (sentence) {
                                    enqueueSpokenSentence(sentence, !sentFirstSentence);
                                    sentFirstSentence = true;
                                }
                            }
                        }
                    } catch(e) {}
                }

                if (isDoneReceived) {
                    // Server finished sending data, break out immediately!
                    break;
                }
            }

            // Flush remaining text in sentenceBuffer
            if (sentenceBuffer.trim()) {
                enqueueSpokenSentence(sentenceBuffer.trim(), !sentFirstSentence);
                sentFirstSentence = true;
            }

            if (!accumulatedText.trim()) {
                accumulatedText = "I have processed your request. How else can I assist you?";
                if (textContainer) textContainer.innerHTML = escapeHtml(accumulatedText);
                enqueueSpokenSentence(accumulatedText, true);
            }

            avaIsThinking = false;

            // Update dialogue memory with final text
            const lastItem = avaDialogue[avaDialogue.length - 1];
            if (lastItem && lastItem.role === 'assistant') {
                lastItem.content = accumulatedText;
            }

            // Wire up replay button
            if (assistantCard) {
                const replayBtn = assistantCard.querySelector('.ava-replay-btn');
                if (replayBtn) {
                    replayBtn.onclick = () => speakAvaText(accumulatedText);
                }
            }

        } catch(err) {
            if (err.name === 'AbortError') {
                console.log('[Ava] Chat stream aborted by user.');
                return;
            }
            console.warn('[Ava] Chat error:', err);
            avaIsThinking = false;
            const errMsg = "I couldn't reach the agent backend. Please ensure the local server is running on port 5000.";
            if (textContainer) textContainer.innerHTML = escapeHtml(errMsg);
            speakAvaText(errMsg);
        }
    }

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

        const name = voiceId.includes('Neerja') ? 'Neerja Expressive' :
                     voiceId.includes('Multilingual') && voiceId.includes('Ava') ? 'Ava Multilingual' :
                     voiceId.includes('Aria') ? 'Aria (Warm)' :
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

})();
