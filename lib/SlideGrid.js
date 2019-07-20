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
/** CSS classname of the slide-grid container */
var SLIDE_GRID = "slide-grid";
/** CSS classname added to the slide-grid container when a long-press is detected on a child */
var WIGGLE = "wiggle";
/** CSS classname added to an object under a mouse- or touch-down that's lasted at least 100ms that isn't yet being dragged */
var PRE_DRAGGING = "pre-dragging";
/** CSS classname of the object being dragged under the cursor */
var DRAGGING = "dragging";
/** CSS classname added to a child while it is animating to where it should be after an exchange but before {exchange} is actually called */
var SLIDING = "sliding";
export var DEFAULT_TUNING = {
    dragStartDistanceSquared: 9,
    slideDurationMS: 100,
    smearDistanceSquaredMin: 20,
    smearDistanceSquaredMax: 500,
    touchTapDurationMaxMS: 300,
    motionOnRails: true,
};
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
        /** thunk — default behavior: any pair may be picked up or exchanged */
        _this.canExchange = function (a, b) {
            var canExchange = _this.props.canExchange;
            if (canExchange === undefined) {
                return true;
            }
            return canExchange(a, b);
        };
        /** thunk — default behavior: no-op */
        _this.done = function (key) {
            var done = _this.props.done;
            if (done === undefined) {
                return;
            }
            return done(key);
        };
        /** thunk — default behavior: no-op */
        _this.tap = function (key) {
            var tap = _this.props.tap;
            if (tap === undefined) {
                return;
            }
            return tap(key);
        };
        /** thunk — default behavior: no-op */
        _this.smear = function (key) {
            var smear = _this.props.smear;
            if (smear === undefined) {
                return;
            }
            return smear(key);
        };
        /** thunk */
        _this.exchange = function (a, b) {
            var exchange = _this.props.exchange;
            exchange(a, b);
        };
        /** detects long-presses: a long touch where the touch doesn't move enough to start a drag. */
        _this.tick = function () {
            var _a = _this.state, active = _a.active, location = _a.location;
            if (active && _this.lastInputEvent.touchCount !== undefined && location && (Date.now() - location.timestamp) > 300) {
                var isDragging = active.classList.contains(DRAGGING);
                if (!isDragging && _this.canExchange(active.id)) {
                    _this.setState({ wiggle: true });
                }
            }
        };
        /** @returns the child under the given event, passing through the actively-dragged child, if any */
        _this.getTarget = function (event) {
            var target = event.target;
            // bubble-up until we find a direct child
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
                    if (_this.state.active === target && !target.classList.contains(DRAGGING) && _this.canExchange(target.id)) {
                        target.classList.add(PRE_DRAGGING);
                    }
                }, 100);
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
                var isDragging = active.classList.contains(DRAGGING);
                var dx = event.clientX - activeLocation.clientX;
                var dy = event.clientY - activeLocation.clientY;
                var d2 = dx * dx + dy * dy;
                if (!isDragging && d2 > _this.tuning.dragStartDistanceSquared) {
                    if (_this.canExchange(active.id)) {
                        active.classList.add(DRAGGING);
                        isDragging = true;
                    }
                }
                if (isDragging) {
                    if (_this.tuning.motionOnRails) {
                        if (Math.abs(dx) > Math.abs(dy)) {
                            dy = 0;
                        }
                        else {
                            dx = 0;
                        }
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
                    active.classList.remove(PRE_DRAGGING);
                    active.style.transform = "translate(" + dx + "px," + dy + "px)";
                    if (target) {
                        var sliding = target.classList.contains(SLIDING);
                        if (target !== active && !sliding && _this.canExchange(target.id, active.id)) {
                            var er = target.getBoundingClientRect();
                            var emptyLeft = emptyLocation.left;
                            var emptyTop = emptyLocation.top;
                            var sdx = emptyLeft - er.left;
                            var sdy = emptyTop - er.top;
                            target.classList.add(SLIDING);
                            target.style.transform = "translate(" + sdx + "px," + sdy + "px)";
                            target.style.transition = "all " + _this.tuning.slideDurationMS + "ms ease-in-out";
                            var a_1 = active.id;
                            var b_1 = target.id;
                            setTimeout(function () {
                                target.classList.remove(SLIDING);
                                target.style.transform = null;
                                target.style.transition = "";
                                _this.exchange(a_1, b_1);
                            }, _this.tuning.slideDurationMS);
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
                if (target === active ? d2 > _this.tuning.smearDistanceSquaredMin : d2 < _this.tuning.smearDistanceSquaredMax) {
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
            var click;
            var done;
            if (state.active) {
                done = state.active.id;
                state.active.classList.remove(PRE_DRAGGING);
                if (state.active.classList.contains(DRAGGING)) {
                    state.active.classList.remove(DRAGGING);
                }
                else if (event.touchCount === undefined) {
                    click = state.active.id;
                }
                else if (target === state.active && state.location) {
                    var dt = Date.now() - state.location.timestamp;
                    if (dt < _this.tuning.touchTapDurationMaxMS) {
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
            _this.recordTouch(event);
            _this.onMouseOrTouchDown(_this.lastInputEvent);
        };
        _this.onTouchMove = function (event) {
            event.preventDefault(); // prevents generation of mouse events 
            _this.recordTouch(event);
            _this.onMouseOrTouchMove(_this.lastInputEvent);
        };
        _this.onTouchEnd = function (event) {
            event.preventDefault(); // prevents generation of mouse events 
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
        };
        _this.state = {};
        _this.uniqueId = "slide-grid-" + ++SLIDE_GRID_INSTANCE_ID;
        return _this;
    }
    SlideGrid.prototype.render = function () {
        return React.createElement("div", { id: this.uniqueId, className: compact([SLIDE_GRID, this.props.className, this.state.wiggle && WIGGLE]).join(" "), onMouseDown: this.onMouseDown, onMouseMove: this.onMouseMove, onMouseUp: this.onMouseUp }, this.children);
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
            console.warn("Couldn't find myself in the DOM, touch support unavailable. (id: " + this.uniqueId + ")");
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
        /** the list of our React children. */
        get: function () {
            return (this.props.children || []);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SlideGrid.prototype, "keys", {
        /** the list of the React keys of our {children}. */
        get: function () {
            return this.children.map(function (child) { return child.key; });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SlideGrid.prototype, "childElements", {
        /** the list of DOM elements which are the visual manifestations of our React {children}. */
        get: function () {
            return compact(this.keys.map(function (e) { return document.getElementById(e); }));
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SlideGrid.prototype, "tuning", {
        get: function () {
            return this.props.tuning || DEFAULT_TUNING;
        },
        enumerable: true,
        configurable: true
    });
    SlideGrid.prototype.componentDidUpdate = function (prevProps, prevState) {
        var target = this.state.active;
        var location = this.state.location;
        var emptyLocation = this.state.emptyLocation;
        // After an exchange, make sure we know the new location of the dragged child,
        // then update its transform so it appears that it hasn't moved from under the cursor.
        if (target && location && emptyLocation) {
            target.style.transform = null;
            var rect = target.getBoundingClientRect();
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
                this.setState(newState);
            }
        }
    };
    return SlideGrid;
}(React.Component));
export default SlideGrid;
//# sourceMappingURL=SlideGrid.js.map