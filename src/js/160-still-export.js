
/* ===== 静止画(高解像度) ===== */
function snapImg(){
  const k=+$('sq').value,jpg=$('sf').value==='jpg';hk=k;adjHQ=true;fit();
  try{paintFrame();cv.toBlob(b=>{if(b)showOut(URL.createObjectURL(b),'img',jpg?'jpg':'png')},jpg?'image/jpeg':'image/png',.92)}finally{adjHQ=false;hk=0;fit()}
}
$('snap').onclick=snapImg;$('sn2').onclick=snapImg;
