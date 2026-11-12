from PIL import Image, ImageChops, ImageEnhance, ImageStat
import os, json
root='tests/visual'
out=os.path.join(root,'output')
refs={'home':'home','topup-sheet':'topup-sheet','withdraw-sheet':'withdraw-sheet'}
scores={}
for name,original in refs.items():
 a=Image.open(os.path.join(root,'references',original+'.png')).convert('RGB')
 b=Image.open(os.path.join(out,name+'.png')).convert('RGB')
 if a.size!=b.size: b=b.resize(a.size,Image.Resampling.LANCZOS)
 overlay=Image.blend(a,b,.5)
 overlay.save(os.path.join(out,'overlay-'+name+'.png'),optimize=True)
 d=ImageChops.difference(a,b)
 ImageEnhance.Contrast(d).enhance(2).save(os.path.join(out,'diff-'+name+'.png'),optimize=True)
 st=ImageStat.Stat(d)
 mae=round(sum(st.mean)/3,2)
 scores[name]={'original':a.size,'current':b.size,'mean_absolute_error_0_255':mae}
 print('COMPARE',name,scores[name])
with open(os.path.join(out,'comparison.json'),'w') as f:json.dump(scores,f,indent=2)
