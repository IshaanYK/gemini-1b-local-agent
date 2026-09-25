"""Model definitions and mapping from Gemini frontend JS source."""

# MODE_CATEGORY enum from 028-6eb337387583.js:
#   1=FAST, 2=THINKING, 3=PRO, 4=AUTO, 5=FAST_DYNAMIC_THINKING, 6=FLASH_LITE

MODELS = {
    # ── Official Google Gemini 2.0 & 1.5 Lineup (Real Models) ───────────────
    "gemini-2.0-flash": {
        "mode": 1, "think": 4,
        "desc": "Google Gemini 2.0 Flash (Official Flagship - High Speed & Multimodal)",
    },
    "gemini-2.0-flash-thinking-exp-01-21": {
        "mode": 2, "think": 0,
        "desc": "Google Gemini 2.0 Flash Thinking Exp (Deep Chain-of-Thought Reasoning)",
    },
    "gemini-2.0-flash-thinking": {
        "mode": 2, "think": 0,
        "desc": "Alias for Gemini 2.0 Flash Thinking Exp",
    },
    "gemini-2.0-pro-exp-02-05": {
        "mode": 3, "think": 4,
        "desc": "Google Gemini 2.0 Pro Experimental (Frontier Depth Reasoning & Coding)",
    },
    "gemini-2.0-pro-exp": {
        "mode": 3, "think": 4,
        "desc": "Alias for Gemini 2.0 Pro Exp",
    },
    "gemini-2.0-pro": {
        "mode": 3, "think": 4,
        "desc": "Alias for Gemini 2.0 Pro Exp",
    },
    "gemini-2.5-pro": {
        "mode": 3, "think": 4,
        "desc": "Google Gemini 2.5 Pro (State-of-the-Art Coding & Reasoning)",
    },
    "gemini-1.5-pro": {
        "mode": 3, "think": 4,
        "desc": "Google Gemini 1.5 Pro (Industry-Leading 2M Context Window)",
    },
    "gemini-2.0-flash-lite": {
        "mode": 6, "think": 4,
        "desc": "Google Gemini 2.0 Flash Lite (Ultra-Low Latency Edge Model)",
    },
    "gemini-1.5-flash": {
        "mode": 1, "think": 4,
        "desc": "Google Gemini 1.5 Flash (Reliable Fast Multimodal Workhorse)",
    },
    "gemini-auto": {
        "mode": 4, "think": 4,
        "desc": "Google Adaptive Auto Routing",
    },
}


def resolve_model(model_name: str, default: str = "gemini-2.0-flash"):
    """Resolve model name to (name, mode_id, think_mode, error, extra_fields).

    Unknown model names fall back to default rather than erroring,
    since upstream clients may request arbitrary model identifiers.
    """
    think_override = None
    if "@think=" in model_name:
        model_name, think_str = model_name.rsplit("@think=", 1)
        try:
            think_override = int(think_str)
        except ValueError:
            return None, None, None, f"Invalid think level: {think_str}", None

    # Handle aliases and old requests gracefully
    if "3.8" in model_name or "3.6" in model_name or "3.5" in model_name:
        if "think" in model_name:
            model_name = "gemini-2.0-flash-thinking-exp-01-21"
        elif "pro" in model_name:
            model_name = "gemini-2.0-pro-exp-02-05"
        else:
            model_name = "gemini-2.0-flash"

    cfg = MODELS.get(model_name)
    if not cfg:
        from .gemini import log
        log(f"Unknown model '{model_name}', falling back to '{default}'")
        model_name = default
        cfg = MODELS[default]

    mode_id = cfg["mode"]
    think_mode = think_override if think_override is not None else cfg["think"]
    extra = cfg.get("extra")

    # If mode is 3 (PRO) but no cookies are provided, gracefully switch to mode 2 (Thinking)
    # or mode 1 (Fast) so the query never breaks or hangs
    try:
        from .gemini import load_cookie, log
        cookie_str, _ = load_cookie()
        if mode_id == 3 and not cookie_str:
            log(f"Notice: Pro model '{model_name}' requested without auth cookies. Using High-Reasoning Thinking mode so request succeeds.")
            mode_id = 2
    except Exception:
        pass

    return model_name, mode_id, think_mode, None, extra
