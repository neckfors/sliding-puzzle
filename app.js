(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const boardEl = $('board'), sizeSelect = $('sizeSelect');
  const tileNodes = new Map();
  let emptyNode = null;
  const state = { size:4, tiles:[], initial:[], moves:0, seconds:0, started:false, solved:false, history:[], timer:null, sound:true, lastCorrect:new Set(), celebratedRows:new Set(), toastTimer:null };
  const total = () => state.size * state.size - 1;
  const goal = i => i === state.size * state.size - 1 ? 0 : i + 1;
  const isCorrect = (v,i) => v === goal(i);
  const fmt = s => String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
  const bestKey = () => 'sliding-puzzle-best-' + state.size;
  const best = () => { try { return JSON.parse(localStorage.getItem(bestKey()) || 'null'); } catch { return null; } };
  function sound(freq=600,duration=.09,type='sine',volume=.035) {
    if (!state.sound) return;
    try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const ctx = sound.ctx || (sound.ctx = new C()); const o=ctx.createOscillator(),g=ctx.createGain(); o.type=type;o.frequency.setValueAtTime(freq,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(80,freq*.72),ctx.currentTime+duration);g.gain.setValueAtTime(volume,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+duration); } catch {}
  }
  function toast(message) { const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),2100); }
  function feedback(message) { $('feedbackText').textContent=message; }
  function startTimer() { if(state.timer || state.solved) return;state.started=true;state.timer=setInterval(()=>{state.seconds++;$('timeValue').textContent=fmt(state.seconds);},1000); }
  function stopTimer() { clearInterval(state.timer);state.timer=null; }
  function updateBest() { const b=best();$('bestValue').textContent=b ? b.moves+' moves' : '—'; }
  function solvedCount() { return state.tiles.reduce((n,v,i)=>n+(v!==0&&isCorrect(v,i)?1:0),0); }
  function rowsDone() { const rows=[];for(let r=0;r<state.size;r++){let ok=true;for(let c=0;c<state.size;c++){const i=r*state.size+c;if(!isCorrect(state.tiles[i],i)){ok=false;break;}}if(ok)rows.push(r);}return rows; }
  function updateProgress() {
    const count=solvedCount(),pct=Math.round(count/total()*100),rows=rowsDone();
    $('progressText').textContent=count+' of '+total()+' tiles in place';$('progressPercent').textContent=pct+'%';$('progressFill').style.width=pct+'%';
    $('movesValue').textContent=state.moves;$('timeValue').textContent=fmt(state.seconds);$('undoBtn').disabled=!state.history.length;
    const doneTile=count>0,doneRow=rows.length>0,donePuzzle=state.solved;
    [['tileMilestone',doneTile],['rowMilestone',doneRow],['puzzleMilestone',donePuzzle]].forEach(([id,done])=>{const el=$(id);el.classList.toggle('done',done);el.querySelector('.milestone-status').textContent=done?'COMPLETED':'IN PROGRESS';});
    $('milestoneCount').textContent=[doneTile,doneRow,donePuzzle].filter(Boolean).length+' / 3';
    updateBest();
  }
  function render(animateCorrect=[], animateMove=true) {
    const previous=new Map();
    if(animateMove)tileNodes.forEach((el,v)=>previous.set(v,el.getBoundingClientRect()));
    if(tileNodes.size!==total()||!emptyNode){
      boardEl.replaceChildren();tileNodes.clear();
      for(let v=1;v<=total();v++){const el=document.createElement('button');el.type='button';el.className='tile';el.textContent=String(v);el.addEventListener('click',()=>move(Number(el.dataset.index)));tileNodes.set(v,el);}
      emptyNode=document.createElement('div');emptyNode.className='tile empty';emptyNode.setAttribute('aria-hidden','true');
    }
    boardEl.style.setProperty('--size',String(state.size));
    const ordered=[];
    state.tiles.forEach((v,i)=>{
      const el=v===0?emptyNode:tileNodes.get(v);
      if(v){el.dataset.index=String(i);el.classList.toggle('correct',isCorrect(v,i));el.classList.toggle('just-correct',animateCorrect.includes(v));el.disabled=state.solved;el.setAttribute('aria-label','Tile '+v+(isCorrect(v,i)?', correctly placed':''));}
      el.style.gridColumn=String((i%state.size)+1);el.style.gridRow=String(Math.floor(i/state.size)+1);
      ordered.push(el);
    });
    boardEl.replaceChildren(...ordered);
    if(animateMove&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&typeof Element.prototype.animate==='function'){
      state.tiles.forEach(v=>{if(!v)return;const el=tileNodes.get(v),from=previous.get(v);if(!from)return;const to=el.getBoundingClientRect(),dx=from.left-to.left,dy=from.top-to.top;if(Math.abs(dx)+Math.abs(dy)>1)el.animate([{transform:'translate3d('+dx+'px,'+dy+'px,0)'},{transform:'translate3d(0,0,0)'}],{duration:310,easing:'cubic-bezier(.22,.82,.22,1)'});});
    }
    updateProgress();
  }
  function celebrateRow(row) {
    const tiles=[...boardEl.querySelectorAll('.tile')].filter(el=>Math.floor(Number(el.dataset.index)/state.size)===row);
    tiles.forEach((el,i)=>{el.classList.remove('row-celebrate');void el.offsetWidth;el.style.setProperty('--row-delay',i*38+'ms');el.classList.add('row-celebrate');});
  }
  function neighbors(i) { const e=state.tiles.indexOf(0),r=Math.floor(i/state.size),c=i%state.size,er=Math.floor(e/state.size),ec=e%state.size;return Math.abs(r-er)+Math.abs(c-ec)===1; }
  function move(i,fromUndo=false) {
    if(state.solved||!neighbors(i)) return false;
    const empty=state.tiles.indexOf(0),value=state.tiles[i],wasCorrect=isCorrect(value,i);
    if(!fromUndo) state.history.push(state.tiles.slice());
    [state.tiles[i],state.tiles[empty]]=[state.tiles[empty],state.tiles[i]];
    if(!fromUndo) {state.moves++;startTimer();}
    const nowCorrect=isCorrect(value,empty);
    render(nowCorrect&&!wasCorrect?[value]:[]);
    if(nowCorrect&&!wasCorrect){sound(790,.13,'sine',.045);feedback('Yes! Number '+value+' found its place.');toast('✦ Number '+value+' — right where it belongs!');}
    else {sound(440,.055,'triangle',.025);feedback('Nice move. Keep finding your flow.');}
    const rows=rowsDone();
    rows.forEach(r=>{if(!state.celebratedRows.has(r)){state.celebratedRows.add(r);celebrateRow(r);sound(980,.16,'sine',.05);setTimeout(()=>sound(1240,.2,'sine',.045),85);toast('✦ ROW COMPLETE!');feedback('A whole row in place. That feels good.');}});
    if(solvedCount()===total()){win();} else updateProgress();
    return true;
  }
  function shuffle() {
    stopTimer();state.seconds=0;state.moves=0;state.started=false;state.solved=false;state.history=[];state.celebratedRows.clear();state.lastCorrect.clear();
    state.tiles=Array.from({length:state.size*state.size},(_,i)=>i===state.size*state.size-1?0:i+1);
    let prev=-1;const steps=state.size===3?90:state.size===4?180:260;
    for(let n=0;n<steps;n++){const e=state.tiles.indexOf(0),r=Math.floor(e/state.size),c=e%state.size,opts=[];if(r>0)opts.push(e-state.size);if(r<state.size-1)opts.push(e+state.size);if(c>0)opts.push(e-1);if(c<state.size-1)opts.push(e+1);const choices=opts.filter(x=>x!==prev);const pick=choices[Math.floor(Math.random()*choices.length)];prev=e;[state.tiles[e],state.tiles[pick]]=[state.tiles[pick],state.tiles[e]];}
    if(solvedCount()===total()) return shuffle();
    $('winOverlay').hidden=true;boardEl.classList.remove('won');feedback('Your first move is waiting.');render([],false);sound(520,.1,'sine',.025);
  }
  function reset() {
    if(!state.initial.length)return;
    stopTimer();state.tiles=state.initial.slice();state.moves=0;state.seconds=0;state.started=false;state.solved=false;state.history=[];state.celebratedRows.clear();$('winOverlay').hidden=true;boardEl.classList.remove('won');feedback('A fresh start. Take your time.');render([],false);
  }
  function undo() { if(!state.history.length||state.solved)return;state.tiles=state.history.pop();state.moves=Math.max(0,state.moves-1);state.seconds=Math.max(0,state.seconds);render();feedback('One move back. No rush.');sound(340,.07,'triangle',.025); }
  function win(){
    state.solved=true;stopTimer();boardEl.classList.add('won');tileNodes.forEach(el=>el.disabled=true);
    const b=best();if(!b||state.moves<b.moves){try{localStorage.setItem(bestKey(),JSON.stringify({moves:state.moves,seconds:state.seconds}));}catch{}}
    $('winSummary').textContent='Solved in '+state.moves+' moves · '+fmt(state.seconds)+'. That was all you.';$('winOverlay').hidden=false;feedback('Every tile. Every row. Beautifully done.');toast('✦ PUZZLE COMPLETE! ✦');
    const frame=$('boardFrame');frame.classList.remove('grand-win');void frame.offsetWidth;frame.classList.add('grand-win');
    [600,800,980,1240,1560].forEach((hz,i)=>setTimeout(()=>sound(hz,.25,'sine',.055),i*115));updateProgress();
  }
  function newSize(size) { state.size=size;state.initial=[];shuffle();state.initial=state.tiles.slice();updateBest(); }
  sizeSelect.addEventListener('change',()=>newSize(Number(sizeSelect.value)));
  $('newGameBtn').addEventListener('click',()=>{newSize(state.size);toast('A new puzzle, just for you.');});
  $('shuffleBtn').addEventListener('click',()=>{newSize(state.size);toast('Shuffled. Let’s find the flow.');});
  $('resetBtn').addEventListener('click',reset);$('undoBtn').addEventListener('click',undo);
  $('playAgainBtn').addEventListener('click',()=>{newSize(state.size);toast('Ready for another?');});
  $('soundBtn').addEventListener('click',()=>{state.sound=!state.sound;$('soundBtn').classList.toggle('active',state.sound);$('soundBtn').textContent=state.sound?'♫':'♪';if(state.sound)sound();});
  $('themeBtn').addEventListener('click',()=>{document.body.classList.toggle('light');try{localStorage.setItem('sliding-puzzle-theme',document.body.classList.contains('light')?'light':'dark');}catch{}});
  document.addEventListener('keydown',e=>{const key=e.key;if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key))return;e.preventDefault();const empty=state.tiles.indexOf(0),r=Math.floor(empty/state.size),c=empty%state.size;let i=-1;if(key==='ArrowUp'&&r<state.size-1)i=empty+state.size;if(key==='ArrowDown'&&r>0)i=empty-state.size;if(key==='ArrowLeft'&&c<state.size-1)i=empty+1;if(key==='ArrowRight'&&c>0)i=empty-1;if(i>=0)move(i);});
  try{if(localStorage.getItem('sliding-puzzle-theme')==='light')document.body.classList.add('light');}catch{}
  newSize(4);state.initial=state.tiles.slice();
  if('serviceWorker' in navigator && location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();