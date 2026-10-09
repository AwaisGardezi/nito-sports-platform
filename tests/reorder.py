import re, io, os

root = r'C:/Users/PcR/OneDrive/Desktop/Sports Platform'
p = os.path.join(root, 'index.html')
src = io.open(p, encoding='utf-8').read()

def frag(name):
    return io.open(os.path.join(root, 'tests', name), encoding='utf-8').read().rstrip() + '\n'

newhero = frag('new-hero.html')
newtrust = frag('new-trust.html')

MARK = re.compile(r'<!-- =+ (.+?) =+ -->')
m_start = src.index('<main>') + len('<main>')
m_end = src.index('</main>')
head, body, tail = src[:m_start], src[m_start:m_end], src[m_end:]

marks = list(MARK.finditer(body))
pre = body[:marks[0].start()] if marks and marks[0].start() > 0 else ''

blocks, order = {}, []
for i, m in enumerate(marks):
    end = marks[i + 1].start() if i + 1 < len(marks) else len(body)
    name = m.group(1).strip()
    blocks[name] = body[m.start():end]
    order.append(name)

print('FOUND:', order)

assert 'HERO' in blocks and 'TRUST STRIP' in blocks and 'CATEGORIES' in blocks

blocks['HERO'] = newhero
blocks['TRUST STRIP'] = newtrust

before = blocks['CATEGORIES']
blocks['CATEGORIES'] = before.replace(
    '<section class="section" id="ranges">',
    '<section class="main-cats" id="ranges">')
print('CATEGORIES band class applied:', blocks['CATEGORIES'] != before)

move = ['CATEGORIES', 'FEATURED LINES', 'TRUST STRIP']
rest = [n for n in order if n not in move and n != 'HERO']

out = pre + newhero + '\n' + ''.join(blocks[n] for n in move) + ''.join(blocks[n] for n in rest)
io.open(p, 'w', encoding='utf-8').write(head + out + tail)

print('NEW ORDER:', ['HERO'] + move + rest)
print('OK')
