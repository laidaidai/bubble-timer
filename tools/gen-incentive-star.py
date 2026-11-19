#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重绘首页激励星星：更粗壮、圆润的五角星（实心 + 虚线轮廓）。

用法：python3 tools/gen-incentive-star.py
输出：assets/incentive/star-filled.png / star-ghost.png（256x256，透明底）
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

S = 1024                 # 超采样画布
OUT = 256                # 输出尺寸
CX = CY = S / 2
R_OUT = 0.44 * S         # 外接半径
R_IN = 0.205 * S         # 内接半径（越大越“肥”）
ROUND_OUT = 0.13         # 五个尖角的圆润度
ROUND_IN = 0.05          # 两个凹角的圆润度
POINTS = 5
ROTATE = -90             # 第一个角朝上

EDGE = (30, 52, 72, 255)        # 描边（--edge 深蓝）
FILL = (255, 199, 63, 255)      # 主体金黄
GHOST = (158, 182, 200, 255)    # 空位虚线


def star_vertices():
    pts = []
    for i in range(POINTS * 2):
        ang = math.radians(ROTATE + i * (360 / (POINTS * 2)))
        r = R_OUT if i % 2 == 0 else R_IN
        pts.append((CX + r * math.cos(ang), CY + r * math.sin(ang)))
    return pts


def rounded_contour(pts, steps=16):
    """把折线拐角改成二次贝塞尔圆弧，得到圆润的轮廓点列。外尖角圆得多一点，凹角只轻轻收。"""
    out = []
    n = len(pts)
    for i, v in enumerate(pts):
        t = ROUND_OUT if i % 2 == 0 else ROUND_IN
        prev = pts[i - 1]
        nxt = pts[(i + 1) % n]
        p1 = (v[0] + (prev[0] - v[0]) * t, v[1] + (prev[1] - v[1]) * t)
        p2 = (v[0] + (nxt[0] - v[0]) * t, v[1] + (nxt[1] - v[1]) * t)
        for s in range(steps + 1):
            k = s / steps
            x = (1 - k) ** 2 * p1[0] + 2 * (1 - k) * k * v[0] + k ** 2 * p2[0]
            y = (1 - k) ** 2 * p1[1] + 2 * (1 - k) * k * v[1] + k ** 2 * p2[1]
            out.append((x, y))
    return out


def scale_about_center(pts, k, dy=0.0):
    return [(CX + (x - CX) * k, CY + (y - CY) * k + dy) for x, y in pts]


def draw_star(k, width_hint, ghost=False):
    contour = rounded_contour(star_vertices())
    contour = scale_about_center(contour, k)
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    w = width_hint
    if ghost:
        # 空位星：同一条轮廓走细实线，避免小尺寸下虚线糊成点
        d.line(contour + [contour[0]], fill=GHOST, width=w, joint='curve')
        for p in contour:
            d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=GHOST)
        return img

    # 扁平贴纸：整块铺色，厚实感靠粗描边和饱满轮廓撑起来，不加高光
    d.polygon(contour, fill=FILL)
    # 描边：在轮廓上描一圈，再补圆头，保证浑厚
    d.line(contour + [contour[0]], fill=EDGE, width=w, joint='curve')
    for p in contour:
        d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=EDGE)
    return img


def save(img, name):
    img = img.filter(ImageFilter.SMOOTH).resize((OUT, OUT), Image.LANCZOS)
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'incentive', name)
    img.save(path, optimize=True)
    print('wrote', path)


def main():
    save(draw_star(0.94, width_hint=58), 'star-filled.png')
    save(draw_star(0.94, width_hint=34, ghost=True), 'star-ghost.png')


if __name__ == '__main__':
    main()
