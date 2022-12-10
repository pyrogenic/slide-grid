var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import * as React from "react";
import compact from "lodash/compact";
import "./SlideGrid.css";
import Graph from "node-dijkstra";
var SLIDE_GRID_INSTANCE_ID = 0;
/** CSS classname of the slide-grid container */
var SLIDE_GRID = "slide-grid";
/** CSS classname added to the slide-grid container when a long-press is detected on a child */
var WIGGLE = "wiggle";
/** CSS classname added to an object under a mouse- or touch-down that's lasted at least 100ms that isn't yet being dragged */
// const PRE_DRAGGING = "pre-dragging";
/** CSS classname of the object being dragged under the cursor */
var DRAGGING = "dragging";
/** CSS classname added to a child while it is animating to where it should be after an exchange but before {exchange} is actually called */
var SLIDING = "sliding";
export var DEFAULT_TUNING = {
    dragStartDistanceSquared: 9,
    slideDurationMS: 100,
    smearDistanceSquaredMin: 900,
    smearDistanceSquaredMax: 625,
    longPressDurationMS: 300,
    motionOnRails: false,
    keepDragInBounds: false,
    ignoreDragOutOfBounds: false,
};
var DRAGGING_STYLE_TRANSFORM = "scale(1.25)";
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
            // const {active, location} = this.state;
            // const touching = this.lastInputEvent.touchCount !== undefined;
            // const dt = location && Date.now() - location.timestamp;
            // if (active && touching && dt && dt > this.state.tuning.slideDurationMS) {
            //     if (!this.state.wiggle) {
            //         if (this.canExchange(active.id) !== false) {
            //             this.setState({wiggle: true});
            //         }
            //     }
            // }
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
                var insideActive = false;
                var otherTarget = _this.childElements.find(function (element) {
                    var rect = element.getBoundingClientRect();
                    var elementLeft = rect.left;
                    var elementTop = rect.top;
                    var elementRight = rect.right;
                    var elementBottom = rect.bottom;
                    var inside = (x > elementLeft &&
                        x < elementRight &&
                        y > elementTop &&
                        y < elementBottom);
                    if (element === target) {
                        insideActive = true;
                        return false;
                    }
                    return inside;
                });
                if (otherTarget) {
                    return otherTarget;
                }
                if (!insideActive) {
                    return undefined;
                }
            }
            return target;
        };
        _this.buildGraph = function () {
            var graph = new Graph();
            _this.keys.forEach(function (a, aIndex, keys) {
                var neighbors = {};
                keys.forEach(function (b) {
                    if (a === b) {
                        return;
                    }
                    var cost = _this.canExchange(a, b);
                    if (cost !== false) {
                        neighbors[b] = cost === true ? 1 : cost;
                    }
                });
                graph.addNode(a, neighbors);
            });
            _this.graph = graph;
        };
        _this.onMouseDown = function (event) {
            _this.lastInputEvent = __assign({ kind: "down" }, event);
            _this.onMouseOrTouchDown(_this.lastInputEvent);
        };
        _this.onMouseMove = function (event) {
            _this.lastInputEvent = __assign({ kind: "move" }, event);
            _this.onMouseOrTouchMove(_this.lastInputEvent);
        };
        _this.onMouseUp = function (event) {
            _this.lastInputEvent = __assign({ kind: "up" }, event);
            _this.onMouseOrTouchUp(_this.lastInputEvent);
        };
        _this.onMouseOrTouchDown = function (event) {
            var target = _this.getTarget(event);
            if (target) {
                var rect = target.getBoundingClientRect();
                var emptyLocation = {
                    left: rect.left,
                    top: rect.top,
                };
                var downEventX_1 = event.clientX;
                var downEventY_1 = event.clientY;
                var touching_1 = event.touchCount !== undefined;
                //console.log({touching});
                _this.lastSmear = undefined;
                _this.setState({
                    active: target,
                    emptyLocation: emptyLocation,
                    location: {
                        timestamp: Date.now(),
                        clientX: downEventX_1,
                        clientY: downEventY_1,
                        offsetX: downEventX_1 - rect.left,
                        offsetY: downEventY_1 - rect.top,
                    },
                });
                setTimeout(function () {
                    var active = _this.state.active;
                    if (active !== target) {
                        return;
                    }
                    if (touching_1 && _this.props.smear) {
                        var lastEventX = _this.lastInputEvent.clientX;
                        var lastEventY = _this.lastInputEvent.clientY;
                        var dx = Math.abs(downEventX_1 - lastEventX);
                        var dy = Math.abs(downEventY_1 - lastEventY);
                        var d2 = dx * dx + dy * dy;
                        if (d2 > _this.tuning.smearDistanceSquaredMin) {
                            //console.log("Moved too far with touch — smearing instead of bulging");
                            return;
                        }
                    }
                    if (active === target && !target.classList.contains(DRAGGING) && _this.canExchange(target.id) !== false) {
                        target.classList.add(DRAGGING);
                        target.style.transform = DRAGGING_STYLE_TRANSFORM;
                    }
                }, _this.tuning.longPressDurationMS);
            }
        };
        _this.onMouseOrTouchMove = function (event, onlyUpdateActive) {
            if (onlyUpdateActive === void 0) { onlyUpdateActive = false; }
            var target = !onlyUpdateActive && _this.getTarget(event);
            var _a = _this.state, active = _a.active, emptyLocation = _a.emptyLocation, activeLocation = _a.location;
            if (!active || !activeLocation) {
                return;
            }
            //console.log({ onlyUpdateActive, target: target && target.id, active: active.id });
            var canDrag = event.touchCount === undefined || event.touchCount > 1 || active.classList.contains(DRAGGING);
            var dx = event.clientX - activeLocation.clientX;
            var dy = event.clientY - activeLocation.clientY;
            if (canDrag && _this.tuning.ignoreDragOutOfBounds) {
                var bounds = active.parentElement.getBoundingClientRect();
                var activeBounds = active.getBoundingClientRect();
                if (activeBounds.left + dx < bounds.left ||
                    activeBounds.top + dy < bounds.top ||
                    activeBounds.right + dx > bounds.right ||
                    activeBounds.bottom + dy > bounds.bottom) {
                    return;
                }
            }
            if (canDrag) {
                var isDragging = active.classList.contains(DRAGGING);
                var d2 = dx * dx + dy * dy;
                if (!isDragging && d2 > _this.tuning.dragStartDistanceSquared) {
                    if (_this.canExchange(active.id) !== false) {
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
                    if (_this.tuning.keepDragInBounds) {
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
                    }
                    var newTransform = "translate(".concat(dx, "px,").concat(dy, "px) ").concat(DRAGGING_STYLE_TRANSFORM);
                    active.style.transform = newTransform;
                    if (target) {
                        if (target === active) {
                            return;
                        }
                        var pathOrResult = _this.graph.path(active.id, target.id);
                        var path;
                        if (Array.isArray(pathOrResult)) {
                            path = pathOrResult;
                        }
                        else {
                            path = pathOrResult === null || pathOrResult === void 0 ? void 0 : pathOrResult.path;
                        }
                        if (!path) {
                            return;
                        }
                        // pop active node off the path
                        path.shift();
                        if (path.find(function (bKey) {
                            var b = document.getElementById(bKey);
                            return b.classList.contains(SLIDING);
                        })) {
                            return;
                        }
                        var newLocation = emptyLocation;
                        var _loop_1 = function () {
                            var exchangeTarget = document.getElementById(path.shift());
                            var er = exchangeTarget.getBoundingClientRect();
                            var emptyLeft = newLocation.left;
                            var emptyTop = newLocation.top;
                            var sdx = emptyLeft - er.left;
                            var sdy = emptyTop - er.top;
                            newLocation = er;
                            exchangeTarget.classList.add(SLIDING);
                            exchangeTarget.style.transform = "translate(".concat(sdx, "px,").concat(sdy, "px)");
                            exchangeTarget.style.transition = "all ".concat(_this.tuning.slideDurationMS, "ms ease-in-out");
                            var a = active.id;
                            var b = exchangeTarget.id;
                            setTimeout(function () {
                                exchangeTarget.classList.remove(SLIDING);
                                exchangeTarget.style.transform = "";
                                exchangeTarget.style.transition = "";
                                _this.exchange(a, b);
                            }, _this.tuning.slideDurationMS);
                        };
                        while (path.length > 0) {
                            _loop_1();
                        }
                    }
                }
                return;
            }
            if (onlyUpdateActive) {
                return;
            }
            // touching something
            if (target && _this.props.smear && target.id !== _this.lastSmear) {
                var targetX = (target.getBoundingClientRect().left + target.getBoundingClientRect().right) / 2;
                var targetY = (target.getBoundingClientRect().top + target.getBoundingClientRect().bottom) / 2;
                var dx_1 = Math.abs(event.clientX - targetX);
                var dy_1 = Math.abs(event.clientY - targetY);
                var d2 = dx_1 * dx_1 + dy_1 * dy_1;
                if (target === active ? d2 > _this.tuning.smearDistanceSquaredMin : d2 < _this.tuning.smearDistanceSquaredMax) {
                    //console.log(`smear from ${this.lastSmear} --> ${target.id} (d2: ${d2}, active: ${active?.id ?? undefined})`);
                    _this.lastSmear = target.id;
                    _this.smear(target.id);
                }
            }
        };
        _this.onMouseOrTouchUp = function (event) {
            var target = _this.getTarget(event);
            var state = _this.state;
            var click;
            var done;
            if (state.active) {
                if (state.active.classList.contains(DRAGGING)) {
                    state.active.classList.remove(DRAGGING);
                }
                else if (event.touchCount === undefined) {
                    click = state.active.id;
                }
                else if (target === state.active && state.location) {
                    var dt = Date.now() - state.location.timestamp;
                    if (dt < _this.tuning.longPressDurationMS) {
                        click = state.active.id;
                    }
                    else {
                        done = state.active.id;
                    }
                }
                else {
                    done = state.active.id;
                }
                state.active.style.transform = "";
            }
            _this.setState({ active: undefined, location: undefined, wiggle: false }, function () {
                if (click) {
                    _this.tap(click);
                }
                else if (done) {
                    _this.done(done);
                }
            });
        };
        _this.onTouchStart = function (event) {
            _this.onMouseOrTouchDown(_this.recordTouch("down", event));
        };
        _this.onTouchMove = function (event) {
            _this.onMouseOrTouchMove(_this.recordTouch("move", event));
        };
        _this.onTouchEnd = function (event) {
            _this.onMouseOrTouchUp(_this.recordTouch("up", event));
        };
        _this.recordTouch = function (kind, event) {
            event.preventDefault(); // prevents generation of mouse events 
            var touchCount = event.touches.length;
            var clientX = 0;
            var clientY = 0;
            for (var i = 0; i < touchCount; ++i) {
                clientX += event.touches[i].clientX;
                clientY += event.touches[i].clientY;
            }
            clientX /= touchCount;
            clientY /= touchCount;
            _this.lastInputEvent = { kind: kind, target: event.target, clientX: clientX, clientY: clientY, touchCount: touchCount };
            return _this.lastInputEvent;
        };
        _this.uniqueId = "slide-grid-".concat(++SLIDE_GRID_INSTANCE_ID);
        return _this;
    }
    SlideGrid.getDerivedStateFromProps = function (nextProps, prevState) {
        return __assign(__assign({}, prevState), { tuning: __assign(__assign({}, DEFAULT_TUNING), nextProps.tuning) });
    };
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
            console.warn("Couldn't find myself in the DOM, touch support unavailable. (id: ".concat(this.uniqueId, ")"));
        }
        this.tickHandle = setInterval(this.tick, 100);
        this.buildGraph();
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
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SlideGrid.prototype, "children", {
        /** the list of our React children. */
        get: function () {
            return (this.props.children || []);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SlideGrid.prototype, "keys", {
        /** the list of the React keys of our {children}. */
        get: function () {
            return this.children.map(function (child) { return child.key; });
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SlideGrid.prototype, "childElements", {
        /** the list of DOM elements which are the visual manifestations of our React {children}. */
        get: function () {
            return compact(this.keys.map(function (e) { return document.getElementById(e); }));
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SlideGrid.prototype, "tuning", {
        get: function () {
            return this.state.tuning;
        },
        enumerable: false,
        configurable: true
    });
    SlideGrid.prototype.componentDidUpdate = function (prevProps, prevState) {
        var target = this.state.active;
        var location = this.state.location;
        var emptyLocation = this.state.emptyLocation;
        // After an exchange, make sure we know the new location of the dragged child,
        // then update its transform so it appears that it hasn't moved from under the cursor.
        if (target && location && emptyLocation && target.classList.contains(DRAGGING)) {
            //console.log("clear target transform");
            target.style.transform = "";
            var rect = target.getBoundingClientRect();
            target.style.transform = DRAGGING_STYLE_TRANSFORM;
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
                return;
            }
        }
        this.buildGraph();
        if (this.lastInputEvent.kind === "move") {
            this.onMouseOrTouchMove(this.lastInputEvent, true);
        }
    };
    return SlideGrid;
}(React.Component));
export default SlideGrid;
//# sourceMappingURL=SlideGrid.js.map