/* ===== コンソールモード（台帳Z-207。2026-11-03に、1つのコンソール＝1つのプロジェクトへ分離。台帳Z-245）=====
   本体と切り離した実験の場。同じアプリの中の隠しモード（別ファイルではない）。
   ・**1つのコンソールには、プロジェクト（試作）を1つだけ置く**。コンソール1＝メモ帳／コンソール2＝ビジュアルプログラミング。別々にモード選択から開く（タブで切り替える形はやめた）。
   ・本体の作品の保存形式（snap／ser／loadProj）・Undo（US）・AC・LAYERS・DOCには、一切触れない（読むだけの窓口を使う）。ここでの操作は、作品・元に戻す・保存に入らない。
   ・開いている間は、本体の再生を止める（閉じる時、ここで止めたものだけ戻す）。コンソール1→2へ直接移る時は、止めた記録を引き継ぐ。
   ・置けるもの＝試作（lab）。`CONSOLE.reg({id,no,mode,ico,name,mount(el),enter?(),leave?()})` で登録する。noはコンソールの番号、modeはモード選択の項目id（`cons`＋番号。`MODES`の項目と同じ）。
     mountは最初に開く時に1回、enter/leaveは見せる／隠す時に呼ばれる。**同じnoの試作を2つ登録しない**（新しい試作は新しい番号のコンソールにする）。
   ・移植の手順（台帳Z-207）：①ここで実機確認 → ②ユーザーがゴーサイン → ③Claudeが本体へ移し、台帳に「移植済」と書く。
   ・UIの一時状態：作品・Undo・保存には入れない。 */
const CONSOLE={labs:[],cur:null,was:null,els:{},
  reg(l){if(!this.labs.some(x=>x.id===l.id||x.no===l.no))this.labs.push(l)},
  isOpen(){return !$('cons').hidden},
  lab(){return this.labs.find(x=>x.id===this.cur)||null},
  /* 開いているコンソールのモードid（開いていなければ編集） */
  modeId(){const l=this.isOpen()?this.lab():null;return l?l.mode:'edit'},
  /* id＝試作のid（'memo'｜'vp'）。開いている間に別のコンソールへ移る時は、閉じずに入れ替える（本体の再生の記録はそのまま） */
  open(id){
    const l=this.labs.find(x=>x.id===id);if(!l)return;
    if(!this.isOpen()){
      this.was={paused};if(!paused)$('pl').click();   /* 本体の再生を止める */
      menuClose();hideTip();
      $('cons').hidden=false;document.body.classList.add('consOpen');
    }
    this.show(id);
  },
  close(){
    if(!this.isOpen())return;
    const l=this.lab();if(l&&l.leave)try{l.leave()}catch(_){}
    $('cons').hidden=true;document.body.classList.remove('consOpen');MODE.cur='edit';
    if(this.was&&!this.was.paused&&paused)$('pl').click();this.was=null;
  },
  show(id){
    const l=this.labs.find(x=>x.id===id);if(!l)return;
    const prev=this.lab();if(prev&&prev!==l&&prev.leave)try{prev.leave()}catch(_){}
    this.cur=id;MODE.cur=l.mode;
    $('cstl').textContent=l.ico+' コンソール'+l.no+'（'+l.name+'）';
    $('cons').setAttribute('aria-label','コンソール'+l.no+'（'+l.name+'）');
    for(const k in this.els)this.els[k].hidden=k!==id;   /* 見せるのは、このコンソールの試作だけ */
    if(!this.els[id]){const el=document.createElement('div');el.dataset.lab=id;$('csbody').appendChild(el);this.els[id]=el;try{l.mount(el)}catch(e){el.textContent='この試作を開けませんでした：'+(e&&e.message||e)}}
    this.els[id].hidden=false;
    if(l.enter)try{l.enter()}catch(_){}
  }
};
$('csx').onclick=()=>CONSOLE.close();
addEventListener('keydown',e=>{if(e.key==='Escape'&&CONSOLE.isOpen()&&!modeIsOpen()){if(CONSOLE.onEsc&&CONSOLE.onEsc()){e.stopImmediatePropagation();e.preventDefault();return}CONSOLE.close();e.stopImmediatePropagation();e.preventDefault()}},true);   /* onEsc＝コンソールの中の開いている窓（メニューなど）を先に閉じる。閉じたらtrue */
