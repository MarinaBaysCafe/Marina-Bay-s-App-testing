import json, subprocess, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.barcode import code128
from reportlab.lib.utils import simpleSplit

SRC=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
menu=json.loads(subprocess.check_output(['node','-e',
 "global.window={};require('%s/menu-default.js');console.log(JSON.stringify(window.MB_DEFAULT_MENU))"%SRC]))

# ---------- stable codes ----------
codes={}      # code -> ['item',id,optIdx] | ['ex',groupId,addonId]
item_code={}  # (id,optIdx)->code
for n,it in enumerate(menu['items'],1):
    for k,_ in enumerate(it['options'],1):
        c='%03d%d'%(n,k); codes[c]=['item',it['id'],k-1]; item_code[(it['id'],k-1)]=c
ex_code={}
n=0
for g in menu['addonGroups']:
    for a in g['items']:
        n+=1; c='8%03d'%n; codes[c]=['ex',g['id'],a['id']]; ex_code[(g['id'],a['id'])]=c
assert len(codes)==len(item_code)+len(ex_code)

# barcodes.js for the POS
with open(SRC+'/barcodes.js','w') as f:
    f.write("/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. */\n")
    f.write("/* Codes printed on the barcode menu. Made from the starting menu, so a code keeps working even if you change prices.\n")
    f.write("   Item code = 3-digit item number + size number (1, 2, 3). Extras start with 8.\n")
    f.write("   If you add NEW items and want barcodes for them, the menu PDF and this file must be regenerated together. */\n")
    f.write("window.MB_BARCODES = {\n")
    for c in sorted(codes): f.write('  "%s": %s,\n'%(c,json.dumps(codes[c])))
    f.write("};\n")

# ---------- fonts ----------
D='/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('Sans',D+'DejaVuSansCondensed.ttf'))
pdfmetrics.registerFont(TTFont('SansB',D+'DejaVuSansCondensed-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SansI',D+'DejaVuSansCondensed-Oblique.ttf'))
pdfmetrics.registerFont(TTFont('SerifB',D+'DejaVuSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Mono',D+'DejaVuSansMono.ttf'))

HARBOR=HexColor('#0d3a4e'); TIDE=HexColor('#2a7f94'); BRASS=HexColor('#b08a57'); INK=HexColor('#14262e')
MUTED=HexColor('#52646c'); LINE=HexColor('#d3dcd9'); SOFT=HexColor('#f1f4f2')

W,H=A4; M=14*mm
CW=40*mm; NAMEW=W-2*M-3*CW        # name column + 3 barcode columns
ROWH=21*mm; CATH=11*mm; BAR=0.5*mm
logo=SRC+'/icons/logo-64.png'

c=canvas.Canvas(''+SRC+'/Marina-Bays-Cafe-Barcode-Menu.pdf',pagesize=A4)
c.setTitle("Marina Bay's Cafe - Barcode Menu"); c.setAuthor("Marina Bay's Cafe")
page=0; y=0
def peso(n): return '\u20b1'+('%d'%n if float(n).is_integer() else '%.2f'%n)

def header():
    global page,y
    page+=1
    c.setFillColor(HARBOR); c.rect(0,H-24*mm,W,24*mm,fill=1,stroke=0)
    c.setFillColor(white); c.circle(M+8*mm,H-12*mm,8.5*mm,fill=1,stroke=0)
    c.setStrokeColor(BRASS); c.setLineWidth(1.2); c.circle(M+8*mm,H-12*mm,8.5*mm,fill=0,stroke=1)
    c.drawImage(logo,M+3*mm,H-17*mm,10*mm,10*mm,mask='auto')
    c.setFillColor(white); c.setFont('SerifB',18); c.drawString(M+21*mm,H-11*mm,"Marina Bay's Cafe")
    c.setFillColor(HexColor('#d8c49d')); c.setFont('SansI',9); c.drawString(M+21*mm,H-17*mm,"Menu  \u00b7  scan the code under the size you want")
    c.setFillColor(BRASS); c.rect(0,H-25.2*mm,W,1.2*mm,fill=1,stroke=0)
    c.setFillColor(MUTED); c.setFont('Sans',7.5); c.drawCentredString(W/2,8*mm,"Page %d"%page)
    y=H-24*mm-9*mm

def need(h):
    global y
    if y-h<16*mm: c.showPage(); header()

def cat_header(cat):
    global y
    need(CATH+ROWH)          # keep header with first row
    c.setFillColor(SOFT); c.rect(M,y-CATH+2*mm,W-2*M,CATH-2*mm,fill=1,stroke=0)
    c.setFillColor(BRASS); c.rect(M,y-CATH+2*mm,1.6*mm,CATH-2*mm,fill=1,stroke=0)
    c.setFillColor(HARBOR); c.setFont('SerifB',12.5); c.drawString(M+4.5*mm,y-6.2*mm,cat['name'])
    if cat.get('note'):
        tw=pdfmetrics.stringWidth(cat['name'],'SerifB',12.5)
        c.setFillColor(BRASS); c.setFont('SansI',8.5); c.drawString(M+4.5*mm+tw+3*mm,y-6.2*mm,cat['note'])
    y-=CATH

def barcode_cell(x,ytop,code,label,price):
    # label + price line(s)
    c.setFillColor(INK)
    lines=simpleSplit(label,'SansB',7,CW-3*mm)[:2] if label else []
    ty=ytop-3*mm
    for ln in lines:
        c.setFont('SansB',7); c.drawString(x,ty,ln); ty-=3*mm
    c.setFont('SansB',8.5); c.setFillColor(HARBOR); c.drawString(x,ty-(0.2*mm if lines else 0),peso(price))
    # barcode (fixed position so all rows line up)
    bc=code128.Code128(code,barHeight=7.5*mm,barWidth=BAR,quiet=False,barFillColor=HexColor('#000000'))
    by=ytop-ROWH+6.2*mm
    bc.drawOn(c,x,by)
    c.setFillColor(MUTED); c.setFont('Mono',6.5); c.drawString(x,by-2.6*mm,code)
    return bc.width

def item_row(it):
    global y
    need(ROWH)
    top=y
    c.setFillColor(INK)
    f='SansB'; size=10.5
    nm=it['name']+(' \u2605' if False else '')
    nlines=simpleSplit(nm,f,size,NAMEW-4*mm)
    ty=top-5*mm
    for ln in nlines[:2]:
        c.setFont(f,size); c.drawString(M,ty,ln); ty-=4.4*mm
    if it.get('best'):
        c.setFillColor(BRASS); c.setFont('SansB',6.5); c.drawString(M,ty+0.4*mm,'BEST SELLER'); ty-=3.2*mm
    if it.get('desc'):
        c.setFillColor(MUTED)
        for ln in simpleSplit(it['desc'],'Sans',7.5,NAMEW-4*mm)[:3]:
            c.setFont('Sans',7.5); c.drawString(M,ty,ln); ty-=3.2*mm
    for k,o in enumerate(it['options']):
        lab='' if o['label'].strip().lower()=='regular' else o['label']
        barcode_cell(M+NAMEW+k*CW,top-1*mm,item_code[(it['id'],k)],lab,o['price'])
    c.setStrokeColor(LINE); c.setLineWidth(.5); c.line(M,top-ROWH+0.5*mm,W-M,top-ROWH+0.5*mm)
    y-=ROWH

header()
for cat in menu['categories']:
    its=[i for i in menu['items'] if i['cat']==cat['id']]
    if not its: continue
    cat_header(cat)
    for it in its: item_row(it)
    y-=3*mm

# Ship upgrades
need(CATH+ROWH+10*mm)
c.setFillColor(HARBOR); c.rect(M,y-CATH+2*mm,W-2*M,CATH-2*mm,fill=1,stroke=0)
c.setFillColor(white); c.setFont('SerifB',12.5); c.drawString(M+4.5*mm,y-6.2*mm,'Ship Upgrades & Extras')
c.setFillColor(HexColor('#d8c49d')); c.setFont('SansI',8.5)
c.drawString(M+4.5*mm+pdfmetrics.stringWidth('Ship Upgrades & Extras','SerifB',12.5)+3*mm,y-6.2*mm,'scan to add as a separate line')
y-=CATH+1*mm
cats={x['id']:x['name'] for x in menu['categories']}
for g in menu['addonGroups']:
    need(7*mm+ROWH)
    c.setFillColor(HARBOR); c.setFont('SansB',9); c.drawString(M,y-4*mm,g['name'])
    c.setFillColor(MUTED); c.setFont('Sans',7.5)
    c.drawString(M+pdfmetrics.stringWidth(g['name'],'SansB',9)+3*mm,y-4*mm,'for '+', '.join(cats[i] for i in g['cats'] if i in cats)[:95])
    y-=6.5*mm
    per=4; cw=(W-2*M)/per
    rows=[g['items'][i:i+per] for i in range(0,len(g['items']),per)]
    for r in rows:
        need(ROWH-3*mm)
        for k,a in enumerate(r):
            x=M+k*cw
            c.setFillColor(INK); c.setFont('SansB',8.5)
            nm=a['name']+(' ('+a['desc']+')' if a.get('desc') else '')
            for j,ln in enumerate(simpleSplit(nm,'SansB',8.5,cw-3*mm)[:2]):
                c.drawString(x,y-3.5*mm-j*3.4*mm,ln)
            c.setFillColor(HARBOR); c.setFont('SansB',8.5); c.drawString(x,y-10.2*mm,peso(a['price']))
            code=ex_code[(g['id'],a['id'])]
            bc=code128.Code128(code,barHeight=6.5*mm,barWidth=BAR,quiet=False,barFillColor=HexColor('#000000'))
            bc.drawOn(c,x+14*mm,y-14.2*mm)
            c.setFillColor(MUTED); c.setFont('Mono',6.5); c.drawString(x+14*mm,y-16.8*mm,code)
        y-=ROWH-3*mm
    y-=2*mm
c.save()
print('pages',page,'codes',len(codes), 'barcode width mm', code128.Code128('0011',barWidth=BAR,quiet=False).width/mm)
