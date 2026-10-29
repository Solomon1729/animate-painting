/* ===== コンソールモード（台帳Z-207）=====
   本体と切り離した実験の場。同じアプリの中の隠しモード（別ファイルではない）。
   ・本体の作品の保存形式（snap／ser／loadProj）・Undo（US）・AC・LAYERS・DOCには、一切触れない（読むだけの窓口を使う）。ここでの操作は、作品・元に戻す・保存に入らない。
   ・開いている間は、本体の再生を止める（閉じる時、ここで止めたものだけ戻す）。
   ・置けるもの＝試作（lab）。`CONSOLE.reg({id,ico,name,mount(el),enter?(),leave?()})` で登録する。mountは最初に開く時に1回、enter/leaveは見せる／隠す時に呼ばれる。
   ・移植の手順（台帳Z-207）：①ここで実機確認 → ②ユーザーがゴーサイン → ③Claudeが本体へ移し、台帳に「移植済」と書く。
   ・UIの一時状態：作品・Undo・保存には入れない。 */
const CONSOLE={labs:[],cur:null,was:null,els:{},
  reg(l){if(!this.labs.some(x=>x.id===l.id))this.labs.push(l)},
  isOpen(){return !$('cons').hidden},
  open(){
    if(this.isOpen())return;
    this.was={paused};if(!paused)$('pl').click();   /* 本体の再生を止める */
    menuClose();hideTip();
    $('cons').hidden=false;document.body.classList.add('consOpen');MODE.cur='cons';
    this.tabs();this.show(this.cur&&this.labs.some(x=>x.id===this.cur)?this.cur:(this.labs[0]||{}).id);
  },
  close(){
    if(!this.isOpen())return;
    const l=this.labs.find(x=>x.id===this.cur);if(l&&l.leave)try{l.leave()}catch(_){}
    $('cons').hidden=true;document.body.classList.remove('consOpen');MODE.cur='edit';
    if(this.was&&!this.was.paused&&paused)$('pl').click();this.was=null;
  },
  tabs(){
    const t=$('cstabs');t.innerHTML='';
    for(const l of this.labs){const b=document.createElement('button');b.textContent=l.ico+' '+l.name;b.dataset.lab=l.id;b.onclick=()=>this.show(l.id);t.appendChild(b)}
  },
  show(id){
    const l=this.labs.find(x=>x.id===id);if(!l)return;
    const prev=this.labs.find(x=>x.id===this.cur);if(prev&&prev!==l&&prev.leave)try{prev.leave()}catch(_){}
    this.cur=id;
    document.querySelectorAll('#cstabs button').forEach(b=>b.classList.toggle('on',b.dataset.lab===id));
    for(const k in this.els)this.els[k].hidden=k!==id;
    if(!this.els[id]){const el=document.createElement('div');el.dataset.lab=id;$('csbody').appendChild(el);this.els[id]=el;try{l.mount(el)}catch(e){el.textContent='この試作を開けませんでした：'+(e&&e.message||e)}}
    this.els[id].hidden=false;
    if(l.enter)try{l.enter()}catch(_){}
  }
};
$('csx').onclick=()=>CONSOLE.close();
$('csmd').onclick=modeOpen;
addEventListener('keydown',e=>{if(e.key==='Escape'&&CONSOLE.isOpen()&&!modeIsOpen()){CONSOLE.close();e.stopImmediatePropagation();e.preventDefault()}},true);

/* 最初の試作＝この場所の使い方と移植の手順（文書。中身は固定） */
CONSOLE.reg({id:'about',ico:'ℹ️',name:'使い方',mount(el){
  el.innerHTML='<div class="note" style="line-height:1.7"><b>コンソールは、本体と切り離した実験の場です。</b><br>'
    +'・ここでの操作は、作品・「元に戻す」・保存に入りません。本体の作品を壊すことはありません。<br>'
    +'・開いている間は、本体の再生を止めています（閉じると戻ります）。<br>'
    +'・失敗しそうなもの、実機で試さないと分からないもの、いまの仕組みを大きく書き換えるのが不安なものは、まずここに置いて試します。<br><br>'
    +'<b>本体へ移す手順</b><br>①ここで実機で確認する　②良ければ、ゴーサインを出す　③Claudeが本体へ移し、台帳に「移植済」と書く<br><br>'
    +'<b>いまある試作</b><br>・📝 メモ帳（メモを書く・txtの読み込みと出力・PDFの出力。端末に保存されます）</div>';
}});
