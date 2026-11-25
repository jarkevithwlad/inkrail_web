// Original six banks from Inkrail.app. No microphone, external audio or clock
// that runs when idle. Decoded samples are cached; voices are disposable.
import {canonicalSound} from './sound-profiles.js';
export function sampleURL(style,name){style=canonicalSound(style);return new URL('./assets/'+(style==='classic'?'':style+'-')+name+'.wav',import.meta.url).href;}
export class Keys{
 constructor(){this.buffers=new Map();this.voices=[];this.generation=0;this.previewGeneration=0;this.timers=[];}
 prime(){try{this.ctx??=new AudioContext({latencyHint:'interactive'});if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch{/* Audio hardware is optional. */}}
 async sound(name,s,preview=false){
  const volume=Math.max(0,Math.min(1,s.soundVolume));
  if(!s.soundEnabled||!volume)return;
  this.prime();if(!this.ctx)return;
  const c=this.ctx,version=this.generation,previewVersion=this.previewGeneration,key=sampleURL(s.typewriterSound,name);
  if(!this.buffers.has(key))this.buffers.set(key,fetch(key).then(r=>{if(!r.ok) throw Error('Missing sample');return r.arrayBuffer()}).then(b=>c.decodeAudioData(b)).catch(e=>{this.buffers.delete(key);throw e}));
  try{
   const buffer=await this.buffers.get(key);
   if(version!==this.generation||preview&&previewVersion!==this.previewGeneration)return;
   const src=c.createBufferSource(),gain=c.createGain();gain.gain.value=volume;src.buffer=buffer;
   src.connect(gain).connect(c.destination);const voice={src,preview,key};this.voices.push(voice);
   const same=this.voices.filter(v=>v.key===key&&v.preview===preview);
   if(same.length>5)try{same[0].src.stop()}catch{}
   src.onended=()=>{this.voices=this.voices.filter(v=>v!==voice);src.disconnect();gain.disconnect()};src.start();
  }catch{/* No working audio device must never interrupt writing. */}
 }
 play(kind,s){this.stopPreview();const name=kind==='carriage'?'return':kind==='space'||kind==='erase'||kind==='bell'?kind:'key-'+(1+Math.floor(Math.random()*3));void this.sound(name,s);}
 preview(s){this.stopPreview();if(!s.soundEnabled||!s.soundVolume)return;this.prime();const v=this.previewGeneration;
  for(const [at,name] of [[0,'key-1'],[165,'key-2'],[350,'space'],[575,'bell'],[1180,'return']])this.timers.push(setTimeout(()=>{if(v===this.previewGeneration)void this.sound(name,s,true);},at));}
 stopPreview(){++this.previewGeneration;for(const t of this.timers)clearTimeout(t);this.timers=[];for(const v of this.voices)if(v.preview)try{v.src.stop()}catch{}}
 stop(){++this.generation;this.stopPreview();for(const v of this.voices)try{v.src.stop()}catch{}}
}
