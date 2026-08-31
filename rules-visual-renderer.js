(()=>{
  const NS='http://www.w3.org/2000/svg';
  const clamp=(value,min=0,max=100)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):0;};
  const point=value=>Array.isArray(value)&&value.length>=2?[clamp(value[0]),clamp(value[1])]:[0,0];
  const text=value=>String(value??'').slice(0,180);
  const svgEl=(name,attrs={})=>{const node=document.createElementNS(NS,name);for(const [key,value] of Object.entries(attrs)){if(value!==undefined&&value!==null)node.setAttribute(key,String(value));}return node;};
  const htmlEl=(name,className='')=>{const node=document.createElement(name);if(className)node.className=className;return node;};

  function fieldBase(svg){
    const bg=svgEl('rect',{x:1,y:1,width:98,height:98,rx:8,fill:'#f0fdf4',stroke:'#86efac','stroke-width':1.2});svg.appendChild(bg);
    const diamond=svgEl('path',{d:'M 50 88 L 75 65 L 50 40 L 25 65 Z',fill:'none',stroke:'#166534','stroke-width':1.5});svg.appendChild(diamond);
    [[50,88,'H'],[75,65,'1'],[50,40,'2'],[25,65,'3']].forEach(([x,y,label])=>{
      const base=svgEl('rect',{x:x-2.4,y:y-2.4,width:4.8,height:4.8,transform:`rotate(45 ${x} ${y})`,fill:'#fff',stroke:'#166534','stroke-width':1});svg.appendChild(base);
      const t=svgEl('text',{x,y:y+8,'text-anchor':'middle','font-size':5,fill:'#475569'});t.textContent=label;svg.appendChild(t);
    });
    const mound=svgEl('circle',{cx:50,cy:65,r:2.2,fill:'#dcfce7',stroke:'#166534','stroke-width':1});svg.appendChild(mound);
    const foulLeft=svgEl('line',{x1:50,y1:88,x2:5,y2:43,stroke:'#bbf7d0','stroke-width':1});svg.appendChild(foulLeft);
    const foulRight=svgEl('line',{x1:50,y1:88,x2:95,y2:43,stroke:'#bbf7d0','stroke-width':1});svg.appendChild(foulRight);
  }

  function addText(svg,x,y,value,options={}){
    const t=svgEl('text',{x:clamp(x),y:clamp(y),'text-anchor':options.anchor||'middle','font-size':options.size||5.2,'font-weight':options.bold?'800':'600',fill:options.fill||'#0f172a'});
    t.textContent=text(value);svg.appendChild(t);return t;
  }

  function renderElement(svg,element,index){
    if(!element||typeof element!=='object')return;
    const type=text(element.type).toLowerCase();
    if(type==='runner'||type==='fielder'){
      const x=clamp(element.x),y=clamp(element.y),runner=type==='runner';
      const circle=svgEl('circle',{cx:x,cy:y,r:4.4,fill:runner?'#2563eb':'#dc2626',stroke:'#fff','stroke-width':1.4});svg.appendChild(circle);
      addText(svg,x,y+1.7,element.label|| (runner?'R':'F'),{size:4,bold:true,fill:'#fff'});return;
    }
    if(type==='ball'){
      const circle=svgEl('circle',{cx:clamp(element.x),cy:clamp(element.y),r:2.2,fill:'#f59e0b',stroke:'#78350f','stroke-width':.8});svg.appendChild(circle);return;
    }
    if(type==='path'){
      const [x1,y1]=point(element.from),[x2,y2]=point(element.to),kind=text(element.kind).toLowerCase();
      const line=svgEl('line',{x1,y1,x2,y2,stroke:kind==='throw'?'#f59e0b':kind==='fielder'?'#dc2626':'#2563eb','stroke-width':2,'stroke-dasharray':kind==='return'?'3 2':'','marker-end':'url(#rulesArrow)'});svg.appendChild(line);return;
    }
    if(type==='zone'){
      const shape=text(element.shape).toLowerCase();
      if(shape==='circle'){
        svg.appendChild(svgEl('circle',{cx:clamp(element.x),cy:clamp(element.y),r:clamp(element.radius,2,30),fill:'#fee2e2','fill-opacity':.7,stroke:'#b91c1c','stroke-width':1.2,'stroke-dasharray':'3 2'}));
        addText(svg,element.x,clamp(element.y)-clamp(element.radius,2,30)-3,element.label,{size:4.2,bold:true,fill:'#991b1b'});
      }else if(shape==='rect'){
        const x=clamp(element.x),y=clamp(element.y),w=clamp(element.width,2,50),h=clamp(element.height,2,50);
        svg.appendChild(svgEl('rect',{x,y,width:w,height:h,rx:3,fill:'#fee2e2','fill-opacity':.7,stroke:'#b91c1c','stroke-width':1.2,'stroke-dasharray':'3 2'}));
        addText(svg,x+w/2,y+h/2,element.label,{size:4,bold:true,fill:'#991b1b'});
      }else if(shape==='line'){
        const [x1,y1]=point(element.from),[x2,y2]=point(element.to);svg.appendChild(svgEl('line',{x1,y1,x2,y2,stroke:'#7c3aed','stroke-width':2,'stroke-dasharray':'4 2'}));
        addText(svg,(x1+x2)/2,Math.max(8,Math.min(y1,y2)-3),element.label,{size:4,bold:true,fill:'#6d28d9'});
      }else if(shape==='edge'){
        const side=text(element.side).toLowerCase(),x=side==='left'?4:96;svg.appendChild(svgEl('line',{x1:x,y1:20,x2:x,y2:90,stroke:'#b91c1c','stroke-width':2.2,'stroke-dasharray':'4 2'}));addText(svg,side==='left'?12:88,17,element.label,{size:4,bold:true,fill:'#991b1b'});
      }
      return;
    }
    if(type==='label'){
      addText(svg,element.x??50,element.y??15,element.text,{size:6,bold:true,fill:'#0f172a'});return;
    }
    if(type==='award'){
      const label=text(element.label||'AWARD');
      const rect=svgEl('rect',{x:30,y:77,width:40,height:10,rx:5,fill:'#ecfdf5',stroke:'#059669','stroke-width':1.2});svg.appendChild(rect);addText(svg,50,83.7,label,{size:4.6,bold:true,fill:'#047857'});return;
    }
  }

  function renderStep(step,index){
    const card=htmlEl('section','rules-visual-step');
    const phase=htmlEl('div','rules-visual-phase');phase.textContent=String(step?.phase||`step ${index+1}`).toUpperCase();card.appendChild(phase);
    const svg=svgEl('svg',{viewBox:'0 0 100 100',role:'img','aria-label':text(step?.caption||step?.phase||'Play diagram')});
    const defs=svgEl('defs');const marker=svgEl('marker',{id:'rulesArrow',markerWidth:6,markerHeight:6,refX:5,refY:3,orient:'auto',markerUnits:'strokeWidth'});marker.appendChild(svgEl('path',{d:'M0,0 L0,6 L6,3 z',fill:'#475569'}));defs.appendChild(marker);svg.appendChild(defs);
    fieldBase(svg);(Array.isArray(step?.elements)?step.elements:[]).slice(0,40).forEach((el,i)=>renderElement(svg,el,i));card.appendChild(svg);
    if(step?.caption){const caption=htmlEl('div','rules-visual-caption');caption.textContent=text(step.caption);card.appendChild(caption);}return card;
  }

  function render(host,definition,altText=''){
    if(!host)return false;host.replaceChildren();
    const data=definition&&typeof definition==='object'?definition:null,steps=Array.isArray(data?.steps)?data.steps.slice(0,6):[];
    if(!data||!steps.length){const empty=htmlEl('div','muted');empty.textContent='No visual steps are available for this ruling yet.';host.appendChild(empty);return false;}
    const wrap=htmlEl('div','rules-visual-grid');steps.forEach((step,index)=>wrap.appendChild(renderStep(step,index)));host.appendChild(wrap);
    if(altText){const sr=htmlEl('p','rules-visual-alt');sr.textContent=text(altText);host.appendChild(sr);}return true;
  }

  function loadSignalsCompanion(){
    if(document.querySelector('script[data-umpire-signals-ui]'))return;
    const script=document.createElement('script');
    script.src='/umpire-signals-ui.js?v=1';
    script.async=false;
    script.dataset.umpireSignalsUi='1';
    document.head.appendChild(script);
  }

  window.RulesVisualRenderer={render};
  loadSignalsCompanion();
})();
