var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import * as React from "react";
import compact from "lodash/compact";
import "./SlideGrid.css";
var SLIDE_GRID_INSTANCE_ID = 0;
/**
 * Immediate children must have the same "key" and "id" attributes:
 *  - key is used when dealing with the React side of things
 *  - id is used when manipulating the DOM.
 */
var SlideGrid = /** @class */ (function (_super) {
    __extends(SlideGrid, _super);
    function SlideGrid(props) {
        var _this = _super.call(this, props) || this;
        _this.lastInputEvent = {};
        _this.canExchange = function (a, b) {
            var canExchange = _this.props.canExchange;
            if (canExchange === undefined) {
                return true;
            }
            return canExchange(a, b);
        };
        _this.done = function (key) {
            var done = _this.props.done;
            if (done === undefined) {
                return;
            }
            return done(key);
        };
        _this.tap = function (key) {
            var tap = _this.props.tap;
            if (tap === undefined) {
                return;
            }
            return tap(key);
        };
        _this.smear = function (key) {
            var smear = _this.props.smear;
            if (smear === undefined) {
                return;
            }
            return smear(key);
        };
        _this.exchange = function (a, b) {
            var exchange = _this.props.exchange;
            exchange(a, b);
        };
        _this.tick = function () {
            var _a = _this.state, active = _a.active, location = _a.location;
            var canExchange = _this.props.canExchange;
            if (active && _this.lastInputEvent.touchCount !== undefined && location && (Date.now() - location.timestamp) > 300) {
                var isDragging = active.classList.contains("dragging");
                if (!isDragging && _this.canExchange(active.id)) {
                    _this.setState({ wiggle: true });
                }
            }
        };
        _this.getTarget = function (event) {
            var target = event.target;
            while (target && !_this.keys.includes(target.id)) {
                target = target.parentElement;
            }
            var x = event.clientX;
            var y = event.clientY;
            if (target && _this.state.active === target) {
                var otherTarget = _this.childElements.find(function (element) {
                    if (element === target) {
                        return false;
                    }
                    var rect = element.getBoundingClientRect();
                    var elementLeft = rect.left;
                    var elementTop = rect.top;
                    var elementRight = rect.right;
                    var elementBottom = rect.bottom;
                    return (x > elementLeft &&
                        x < elementRight &&
                        y > elementTop &&
                        y < elementBottom);
                });
                if (otherTarget) {
                    return otherTarget;
                }
            }
            return target;
        };
        _this.onMouseDown = function (event) {
            _this.onMouseOrTouchDown(event);
        };
        _this.onMouseOrTouchDown = function (event) {
            var target = _this.getTarget(event);
            if (target) {
                // console.log(target);
                var rect = target.getBoundingClientRect();
                var emptyLocation = {
                    left: rect.left,
                    top: rect.top,
                };
                _this.setState({
                    active: target,
                    emptyLocation: emptyLocation,
                    location: {
                        timestamp: Date.now(),
                        clientX: event.clientX,
                        clientY: event.clientY,
                        offsetX: event.clientX - rect.left,
                        offsetY: event.clientY - rect.top,
                    },
                });
                setTimeout(function () {
                    if (_this.state.active === target && !target.classList.contains("dragging") && _this.canExchange(target.id)) {
                        target.classList.add("pre-dragging");
                    }
                }, 100);
                //console.log({ mouseDown: target.id, event });
            }
        };
        _this.onMouseMove = function (event) {
            _this.onMouseOrTouchMove(event);
        };
        _this.onMouseOrTouchMove = function (event) {
            var target = _this.getTarget(event);
            var _a = _this.state, active = _a.active, emptyLocation = _a.emptyLocation, activeLocation = _a.location;
            if (!active || !activeLocation) {
                return;
            }
            var canDrag = event.touchCount === undefined || event.touchCount > 1 || _this.state.wiggle;
            if (canDrag) {
                var isDragging = active.classList.contains("dragging");
                var dx = event.clientX - activeLocation.clientX;
                var dy = event.clientY - activeLocation.clientY;
                var d2 = dx * dx + dy * dy;
                if (!isDragging && d2 > 9) {
                    if (_this.canExchange(active.id)) {
                        active.classList.add("dragging");
                        active.style.zIndex = "1";
                        isDragging = true;
                    }
                }
                if (isDragging) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        dy = 0;
                    }
                    else {
                        dx = 0;
                    }
                    var bounds = active.parentElement.getBoundingClientRect();
                    var activeBounds = active.getBoundingClientRect();
                    if (activeBounds.left + dx < bounds.left) {
                        dx = bounds.left - activeBounds.left;
                    }
                    if (activeBounds.top + dy < bounds.top) {
                        dy = bounds.top - activeBounds.top;
                    }
                    if (activeBounds.right + dx > bounds.right) {
                        dx = bounds.right - activeBounds.right;
                    }
                    if (activeBounds.bottom + dy > bounds.bottom) {
                        dy = bounds.bottom - activeBounds.bottom;
                    }
                    active.classList.remove("pre-dragging");
                    active.style.transform = "translate(" + dx + "px," + dy + "px)";
                    if (target) {
                        var sliding = target.classList.contains("sliding");
                        if (target !== active && !sliding && _this.canExchange(target.id, active.id)) {
                            var er = target.getBoundingClientRect();
                            var emptyLeft = emptyLocation.left;
                            var emptyTop = emptyLocation.top;
                            var sdx = emptyLeft - er.left;
                            var sdy = emptyTop - er.top;
                            target.classList.add("sliding");
                            target.style.transform = "translate(" + sdx + "px," + sdy + "px)";
                            target.style.transition = "all 0.1s ease-in-out";
                            var a_1 = active.id;
                            var b_1 = target.id;
                            setTimeout(function () {
                                target.classList.remove("sliding");
                                target.style.transform = null;
                                target.style.transition = "";
                                _this.exchange(a_1, b_1);
                            }, 10);
                        }
                    }
                }
            }
            else if (target) { // touching something
                var targetX = (target.getBoundingClientRect().left + target.getBoundingClientRect().right) / 2;
                var targetY = (target.getBoundingClientRect().top + target.getBoundingClientRect().bottom) / 2;
                var dx = Math.abs(event.clientX - targetX);
                var dy = Math.abs(event.clientY - targetY);
                var d2 = dx * dx + dy * dy;
                console.log({ id: target.id, d2: d2 });
                if (target === active ? d2 > 20 : d2 < 500) {
                    _this.smear(target.id);
                }
            }
        };
        _this.onMouseUp = function (event) {
            _this.onMouseOrTouchUp(event);
        };
        _this.onMouseOrTouchUp = function (event) {
            var target = _this.getTarget(event);
            var state = _this.state;
            console.log({ onMouseOrTouchUp: event, target: target, active: state.active });
            var click;
            var done;
            if (state.active) {
                done = state.active.id;
                state.active.classList.remove("pre-dragging");
                if (state.active.classList.contains("dragging")) {
                    state.active.classList.remove("dragging");
                }
                else if (event.touchCount === undefined) {
                    click = state.active.id;
                }
                else if (target === state.active && state.location) {
                    var dt = Date.now() - state.location.timestamp;
                    console.log({ dt: dt });
                    if (dt < 300) {
                        click = state.active.id;
                    }
                }
                state.active.style.transform = null;
            }
            _this.setState({ active: undefined, location: undefined, wiggle: false }, function () {
                if (click) {
                    _this.tap(click);
                }
                else {
                    _this.done(done);
                }
            });
        };
        _this.onTouchStart = function (event) {
            event.preventDefault(); // prevents generation of mouse events 
            // console.log({ onTouchStart: event });
            _this.recordTouch(event);
            _this.onMouseOrTouchDown(_this.lastInputEvent);
        };
        //    private onTouchMove = (event: React.TouchEvent<any>) => {
        _this.onTouchMove = function (event) {
            event.preventDefault(); // prevents generation of mouse events 
            // event.persist();
            // console.log({ onTouchMove: event });
            _this.recordTouch(event);
            _this.onMouseOrTouchMove(_this.lastInputEvent);
        };
        _this.onTouchEnd = function (event) {
            event.preventDefault(); // prevents generation of mouse events 
            // event.persist();
            // console.log({ onTouchEnd: event });
            _this.recordTouch(event);
            _this.onMouseOrTouchUp(_this.lastInputEvent);
        };
        _this.recordTouch = function (event) {
            var touchCount = event.touches.length;
            var clientX = 0;
            var clientY = 0;
            for (var i = 0; i < touchCount; ++i) {
                clientX += event.touches[i].clientX;
                clientY += event.touches[i].clientY;
            }
            clientX /= touchCount;
            clientY /= touchCount;
            _this.lastInputEvent = { target: event.target, clientX: clientX, clientY: clientY, touchCount: touchCount };
            console.log(_this.lastInputEvent);
        };
        _this.state = {};
        _this.uniqueId = "slide-grid-" + ++SLIDE_GRID_INSTANCE_ID;
        return _this;
    }
    SlideGrid.prototype.render = function () {
        return React.createElement("div", { id: this.uniqueId, className: compact(["slide-grid", this.props.className, this.state.wiggle && "wiggle"]).join(" "), onMouseDown: this.onMouseDown, onMouseMove: this.onMouseMove, onMouseUp: this.onMouseUp }, this.children);
    };
    SlideGrid.prototype.componentDidMount = function () {
        // React's unified event system uses passive handlers which makes avoiding scroll-on-touch-drag impossible 
        var myDomElement = this.myDomElement;
        if (myDomElement) {
            myDomElement.addEventListener("touchstart", this.onTouchStart, { passive: false });
            myDomElement.addEventListener("touchmove", this.onTouchMove, { passive: false });
            myDomElement.addEventListener("touchend", this.onTouchEnd, { passive: false });
            myDomElement.addEventListener("touchcancel", this.onTouchEnd, { passive: false });
        }
        else {
            console.error("Couldn't find myself in the DOM: " + this.uniqueId);
        }
        this.tickHandle = setInterval(this.tick, 100);
    };
    SlideGrid.prototype.componentWillUnmount = function () {
        var tickHandle = this.tickHandle;
        if (tickHandle !== undefined) {
            this.tickHandle = undefined;
            clearInterval(this.tickHandle);
        }
    };
    Object.defineProperty(SlideGrid.prototype, "myDomElement", {
        get: function () {
            return document.getElementById(this.uniqueId);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SlideGrid.prototype, "children", {
        get: function () {
            return (this.props.children || []);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SlideGrid.prototype, "childElements", {
        get: function () {
            return compact(this.keys.map(function (e) { return document.getElementById(e); }));
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SlideGrid.prototype, "keys", {
        get: function () {
            return this.children.map(function (child) { return child.key; });
        },
        enumerable: true,
        configurable: true
    });
    SlideGrid.prototype.componentDidUpdate = function (prevProps, prevState) {
        var target = this.state.active;
        var location = this.state.location;
        var emptyLocation = this.state.emptyLocation;
        if (target && location && emptyLocation) {
            // console.log({ oldRect: target.getBoundingClientRect() });
            target.style.transform = null;
            var rect = target.getBoundingClientRect();
            console.log({ newRect: rect });
            if (rect.left.toFixed(0) !== emptyLocation.left.toFixed(0)
                || rect.top.toFixed(0) !== emptyLocation.top.toFixed(0)) {
                var newEmptyLocation = {
                    left: rect.left,
                    top: rect.top,
                };
                var newState = {
                    emptyLocation: newEmptyLocation,
                    location: {
                        timestamp: location.timestamp,
                        clientX: newEmptyLocation.left + location.offsetX,
                        clientY: newEmptyLocation.top + location.offsetY,
                        offsetX: location.offsetX,
                        offsetY: location.offsetY,
                    },
                };
                console.log({ oldState: this.state, newState: newState });
                this.setState(newState);
            }
        }
    };
    return SlideGrid;
}(React.Component));
export default SlideGrid;
//# sourceMappingURL=SlideGrid.js.map