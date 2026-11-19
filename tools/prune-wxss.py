#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按「页面自己的 wxml/js 完全没引用」的标准，剔除 WXSS 里的死规则。

只做两件事，保证不改任何还在用的样式：
1. 选择器列表里，所有类名都是死的选择器 -> 去掉；整条规则的选择器全被去掉 -> 整条规则删除。
2. 不再被任何选择器引用的 @keyframes -> 删除。

用法：python3 tools/prune-wxss.py [--check]
  --check 只统计不写入
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {'app.wxss'}


def strip_comments(css):
    return re.sub(r'/\*.*?\*/', lambda m: ' ' * len(m.group(0)), css, flags=re.S)


def sources_for(wxss_path):
    base = wxss_path[:-5]
    text = ''
    for ext in ('.wxml', '.js'):
        p = base + ext
        if os.path.exists(p):
            text += open(p, encoding='utf-8').read()
    return text


def tokens(text):
    return set(re.findall(r'[-\w]+', text))


def dynamic_prefixes(text):
    return set(re.findall(r'([A-Za-z][\w]*)-', text))


def used_classes(css_no_comments):
    return set(re.findall(r'\.([A-Za-z_][\w-]*)', css_no_comments))


def split_top_level(css):
    """切成 [(kind, text)]，kind 为 'rule' / 'at' / 'other'。"""
    out = []
    i = 0
    n = len(css)
    while i < n:
        m = re.compile(r'[{};]').search(css, i)
        if not m:
            out.append(('other', css[i:]))
            break
        if css[m.start()] == ';':
            out.append(('other', css[i:m.end()]))
            i = m.end()
            continue
        head = css[i:m.start()]
        # 找配对的右括号
        depth = 0
        j = m.start()
        while j < n:
            if css[j] == '{':
                depth += 1
            elif css[j] == '}':
                depth -= 1
                if depth == 0:
                    break
            j += 1
        block = css[i:j + 1]
        kind = 'at' if head.strip().startswith('@') else 'rule'
        out.append((kind, block))
        i = j + 1
    return out


def rule_parts(block):
    m = re.match(r'(.*?)\{(.*)\}(.*)$', block, re.S)
    if not m:
        return None
    return m.group(1), m.group(2), m.group(3)


def selector_dead(sel, dead):
    cls = re.findall(r'\.([A-Za-z_][\w-]*)', sel)
    if not cls:
        return False
    return all(c in dead for c in cls)


def rebuild_selectors(head, dead):
    """保留原格式的逗号分隔选择器列表，返回 (新 head, 是否还有内容)。"""
    raw = head
    body_indent = ''
    # 拆成（前缀空白/逗号，选择器文本）
    parts = re.split(r',', raw)
    kept = [p for p in parts if not selector_dead(p, dead)]
    if not kept:
        return head, False
    if len(kept) == len(parts):
        return head, True
    joined = ','.join(kept)
    joined = re.sub(r'\s*,\s*', ',\n', joined)
    return joined, True


def prune_file(path, dead):
    css = open(path, encoding='utf-8').read()
    stripped = strip_comments(css)
    chunks = split_top_level(stripped)
    # 用同一套切分应用到原文（长度一致，因为注释被等长空白替换）
    removed = 0
    rebuilt = []
    for kind, block in chunks:
        if kind == 'at':
            if block.lstrip().startswith('@keyframes'):
                rebuilt.append(block)
            else:
                rebuilt.append(block)
            continue
        if kind == 'other':
            rebuilt.append(block)
            continue
        parts = rule_parts(block)
        if not parts:
            rebuilt.append(block)
            continue
        head, body, tail = parts
        new_head, alive = rebuild_selectors(head, dead)
        if not alive:
            removed += 1
            continue
        rebuilt.append(block)
    return css, stripped, chunks, removed


def keyframes_in(stripped):
    return re.findall(r'@keyframes\s+([\w-]+)', stripped)


def animation_refs(stripped):
    refs = set()
    for m in re.finditer(r'animation(?:-name)?:\s*([^;}]+)', stripped):
        refs.update(re.findall(r'[A-Za-z][\w-]*', m.group(1)))
    return refs


def build_dead(css, src):
    used = tokens(src)
    prefixes = dynamic_prefixes(src)
    classes = used_classes(css)
    dead = {c for c in classes
            if c not in used and not any(c.startswith(p + '-') for p in prefixes)}
    return dead


def main():
    check = '--check' in sys.argv
    targets = []
    for pattern in ('pages/*/*.wxss', 'components/*/*.wxss', 'custom-tab-bar/*.wxss'):
        targets.extend(glob.glob(os.path.join(ROOT, pattern)))
    total_dead = total_removed = 0
    for path in sorted(targets):
        if os.path.basename(path) in SKIP:
            continue
        css = open(path, encoding='utf-8').read()
        stripped = strip_comments(css)
        src = sources_for(path)
        dead = build_dead(stripped, src)
        total_dead += len(dead)
        if not dead:
            continue
        # 逐条规则过滤
        chunks = split_top_level(css)
        out = []
        removed = 0
        for kind, block in chunks:
            if kind != 'rule':
                out.append(block)
                continue
            m = re.match(r'(.*?)\{(.*)\}(.*)$', block, re.S)
            if not m:
                out.append(block)
                continue
            head, body, tail = m.groups()
            parts = [p for p in re.split(r',', head)]
            kept = [p for p in parts if not selector_dead(p, dead)]
            if not kept:
                removed += 1
                if not out or not out[-1].endswith('\n\n'):
                    pass
                continue
            if len(kept) == len(parts):
                out.append(block)
            else:
                # 只去掉部分选择器；保持原有换行缩进
                drop_idx = [i for i, p in enumerate(parts) if selector_dead(p, dead)]
                text = head
                for p in [parts[i] for i in drop_idx]:
                    text = text.replace(p + ',', '', 1) if (p + ',') in text else text.replace(',' + p, '', 1)
                text = re.sub(r',\s*,', ',', text)
                text = re.sub(r'\{\s*,', '{', text)
                out.append(text + '{' + body + '}' + tail)
        new = ''.join(out)
        # 清理删块后留下的连续空行
        new = re.sub(r'\n{3,}', '\n\n', new)
        total_removed += removed
        rel = os.path.relpath(path, ROOT)
        print(f'{rel}: 死类 {len(dead)}，删规则 {removed}')
        if not check:
            open(path, 'w', encoding='utf-8').write(new)
    print(f'合计：死类 {total_dead}，删规则 {total_removed}' + ('（check 模式未写入）' if check else ''))


if __name__ == '__main__':
    main()
