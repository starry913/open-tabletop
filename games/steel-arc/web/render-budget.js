// Budget physical pixels, not CSS pixels multiplied by an unbounded OS scale.
// HUD text stays native DOM resolution; simulation never depends on this value.
export function renderSize(cssWidth,dpr=1){
  const scale=Math.min(1.5,Math.max(.75,(Number(cssWidth)||1280)/1280*Math.max(1,Number(dpr)||1)));
  const units=Math.round(1280*scale/16),width=units*16,height=units*9;
  return {scale:width/1280,width,height};
}
