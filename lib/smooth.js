const motionScroll = (() => {

  let _target = document.documentElement;
  let _pos = _target.scrollTop;  
  let _moving = false;
  let _delta ;

  const _speed = 30,
    _smooth = 12;

  const scrolled = (e)=> {    
    e.preventDefault(); 
    
    _delta = normalizeWheelDelta(e);
    _pos += -_delta * _speed;
    _pos = Math.max(0, Math.min(_pos, _target.scrollHeight - _target.clientHeight));

    if (!_moving) update();
  }

  const normalizeWheelDelta = (e) => {
    if (e.detail) {
      if (e.wheelDelta)
        return (e.wheelDelta / e.detail / 40) * (e.detail > 0 ? 1 : -1);
      else return -e.detail / 3;
    } else return e.wheelDelta / 120;
  }

  const update = () => {
    _moving = true;
    _delta = (_pos - _target.scrollTop) / _smooth;
    _target.scrollTop += _delta;

    if (Math.abs(_delta) > 0.5) requestAnimationFrame(update);
    else _moving = false;
  }

  const _addEvnt = () =>{
    _target.addEventListener("wheel", scrolled, { passive: false });
    _target.addEventListener("mousewheel", scrolled, { passive: false });
  }

  const _initialize = () =>{
    _addEvnt()
  }

  return {
    init : _initialize
  }
})()

window.onload = motionScroll.init();
