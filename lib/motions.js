const motions = {
  setLayout: (_el) => {
    if (_el.offsetTop == undefined) return;

    return {
      info: {
        offsetTop: _el.offsetTop,
        offsetHeight: _el.offsetHeight - innerHeight,
      },
    };
  },
  calcValue: (_el, _options, _scroll) => {
    let partScroll = Math.max(
      0,
      _scroll - _el.offsetHeight * _options.startPoint
    );
    let partStart = _el.offsetHeight * _options.startPoint;
    let partEnd = _el.offsetHeight * _options.endPoint;
    let partRatio = Math.min(1, partScroll / (partEnd - partStart));

    if (_scroll <= partStart) {
      partValue = _options.startValue;
    } else if (_scroll >= partEnd) {
      partValue = _options.endValue;
    } else {
      partValue =
        partRatio.toFixed(4) * 1 * (_options.endValue - _options.startValue) +
        _options.startValue;
    }
    return partValue;
  },
  ratio: (_el, _scroll) => {
    let currentScroll, offsetTop;

    if (_options.offsetTop !== undefined) {
      offsetTop = _options.offsetTop;
      currentScroll = Math.max(0, _scroll - offsetTop);
    }

    return (currentScroll / _options.offsetHeight).toFixed(4) * 1;
  },
};
