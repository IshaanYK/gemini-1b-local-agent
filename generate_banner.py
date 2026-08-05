import math
import os
from PIL import Image, ImageDraw, ImageFont

def create_banner_gif():
    width = 800
    height = 220
    num_frames = 30
    frames = []

    # Colors
    bg_color = (14, 14, 17) # #0e0e11
    gemini_blue = (66, 133, 244)
    gemini_purple = (155, 81, 224)
    gemini_pink = (233, 30, 99)

    for i in range(num_frames):
        # Create image
        img = Image.new("RGB", (width, height), bg_color)
        draw = ImageDraw.Draw(img)

        t = i / num_frames * 2 * math.pi
        pulse = (math.sin(t) + 1) / 2 # 0 to 1

        # Draw matrix grid background subtle dots
        grid_spacing = 16
        for x in range(0, width, grid_spacing):
            for y in range(0, height, grid_spacing):
                wave = math.sin((x * 0.02) + (y * 0.02) + t)
                dot_size = 1 + int((wave + 1) * 0.8)
                dot_alpha = int(20 + (wave + 1) * 20)
                draw.ellipse(
                    [x - dot_size, y - dot_size, x + dot_size, y + dot_size],
                    fill=(dot_alpha, dot_alpha, int(dot_alpha * 1.5))
                )

        # Draw glowing Gemini Sparkle Star Logo on left
        cx, cy = 110, 110
        star_radius = 45 + int(pulse * 6)
        
        # Outer glow
        for r in range(star_radius + 20, 5, -5):
            alpha = int((1 - (r / (star_radius + 20))) * 80)
            # interpolate color
            color = (
                int(gemini_blue[0] * (1 - pulse) + gemini_purple[0] * pulse),
                int(gemini_blue[1] * (1 - pulse) + gemini_purple[1] * pulse),
                int(gemini_blue[2] * (1 - pulse) + gemini_purple[2] * pulse)
            )
            # 4-point star curve
            pts = []
            steps = 40
            for step in range(steps):
                angle = step / steps * 2 * math.pi
                # 4 point star math: r_factor
                r_factor = 1.0 / (abs(math.cos(angle))**0.8 + abs(math.sin(angle))**0.8 + 0.01)
                curr_r = (r * 0.4) * r_factor
                pts.append((cx + curr_r * math.cos(angle), cy + curr_r * math.sin(angle)))
            if len(pts) > 2:
                draw.polygon(pts, fill=color)

        # Core star
        pts_core = []
        for step in range(40):
            angle = step / 40 * 2 * math.pi
            r_factor = 1.0 / (abs(math.cos(angle))**0.8 + abs(math.sin(angle))**0.8 + 0.01)
            curr_r = 35 * r_factor
            pts_core.append((cx + curr_r * math.cos(angle), cy + curr_r * math.sin(angle)))
        draw.polygon(pts_core, fill=(255, 255, 255))

        # Title Text - LED Matrix Style rendering
        title_text = "1B GEMINI LOCAL AGENT"
        subtitle_text = "ZERO COST  •  1B+ TOKEN CONTEXT  •  NATIVE TOOL SUITE"

        # Try default font
        font_large = None
        font_small = None
        try:
            font_large = ImageFont.truetype("arial.ttf", 36)
            font_small = ImageFont.truetype("arial.ttf", 14)
        except Exception:
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()

        # Draw main title
        tx, ty = 190, 75
        
        # Glow title
        glow_color = (
            int(gemini_purple[0] * (1 - pulse) + gemini_pink[0] * pulse),
            int(gemini_purple[1] * (1 - pulse) + gemini_pink[1] * pulse),
            int(gemini_purple[2] * (1 - pulse) + gemini_pink[2] * pulse)
        )
        
        draw.text((tx - 1, ty), title_text, font=font_large, fill=glow_color)
        draw.text((tx + 1, ty), title_text, font=font_large, fill=glow_color)
        draw.text((tx, ty - 1), title_text, font=font_large, fill=glow_color)
        draw.text((tx, ty + 1), title_text, font=font_large, fill=glow_color)
        draw.text((tx, ty), title_text, font=font_large, fill=(255, 255, 255))

        # Subtitle
        draw.text((tx, ty + 50), subtitle_text, font=font_small, fill=(154, 160, 166))

        # Top & Bottom accent gradient line
        line_y = height - 8
        for lx in range(width):
            ratio = lx / width
            col = (
                int(gemini_blue[0] * (1 - ratio) + gemini_pink[0] * ratio),
                int(gemini_blue[1] * (1 - ratio) + gemini_pink[1] * ratio),
                int(gemini_blue[2] * (1 - ratio) + gemini_pink[2] * ratio)
            )
            draw.line([(lx, line_y), (lx, line_y + 2)], fill=col)

        frames.append(img)

    output_path = "hero_banner.gif"
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=60, # 60ms per frame = ~16 FPS
        loop=0
    )
    print(f"Generated animated banner: {output_path}")

if __name__ == "__main__":
    create_banner_gif()
