"""Generate small, royalty-free MIDI loops for BirdView's ten habitats."""
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "music"
TPQ = 480
SCALES = [(60,[0,4,7,11]),(62,[0,3,7,10]),(65,[0,4,7,9]),(57,[0,5,7,12]),(55,[0,4,9,11]),(64,[0,3,7,12]),(59,[0,4,7,14]),(67,[0,4,7,11]),(62,[0,5,9,12]),(60,[0,4,9,14])]
TEMPOS = [82,76,72,80,74,68,70,64,78,72]

def vlq(n):
    out=[n&127]; n >>= 7
    while n: out.append(128|(n&127)); n >>= 7
    return bytes(reversed(out))

def make(root, intervals, bpm):
    e=bytearray(); micros=60_000_000//bpm
    e += b'\x00\xff\x51\x03'+micros.to_bytes(3,'big')+b'\x00\xc0\x0b'
    notes=[root+intervals[i%len(intervals)]+(12 if i in (3,7) else 0) for i in range(16)]
    bass=root-12
    for i,note in enumerate(notes):
        bn=bass+intervals[(i//4)%len(intervals)]
        if i%4==0: e += b'\x00\x90'+bytes([bn,38])
        e += b'\x00\x90'+bytes([note,42+(i%3)*5])+vlq(TPQ)+b'\x80'+bytes([note,0])
        if i%4==3: e += b'\x00\x80'+bytes([bn,0])
    e += b'\x00\xff\x2f\x00'
    return b'MThd'+struct.pack('>IHHH',6,0,1,TPQ)+b'MTrk'+struct.pack('>I',len(e))+e

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    for i,((root,scale),bpm) in enumerate(zip(SCALES,TEMPOS),1):
        (OUT/f'level{i:02}.mid').write_bytes(make(root,scale,bpm))
    print(f"Created 10 MIDI loops in {OUT}")

if __name__=='__main__': main()
