import * as React from "react";
import compact from "lodash/compact";
import "./SlideGrid.css";
import Graph from "node-dijkstra";

let SLIDE_GRID_INSTANCE_ID = 0;

/** CSS classname of the slide-grid container */
const SLIDE_GRID = "slide-grid";

/** CSS classname added to the slide-grid container when a long-press is detected on a child */
const WIGGLE = "wiggle";

/** CSS classname added to an object under a mouse- or touch-down that's lasted at least 100ms that isn't yet being dragged */
const PRE_DRAGGING = "pre-dragging";

/** CSS classname of the object being dragged under the cursor */
const DRAGGING = "dragging";

/** CSS classname added to a child while it is animating to where it should be after an exchange but before {exchange} is actually called */
const SLIDING = "sliding";

export interface ISlideGridTuning {
    dragStartDistanceSquared: number;
    slideDurationMS: number;
    smearDistanceSquaredMin: number;
    smearDistanceSquaredMax: number;
    touchTapDurationMaxMS: number;
    motionOnRails: boolean;
    keepDragInBounds: boolean;
    ignoreDragOutOfBounds: boolean;
}

export const DEFAULT_TUNING: ISlideGridTuning = {
    dragStartDistanceSquared: 9,
    slideDurationMS: 100,
    smearDistanceSquaredMin: 20,
    smearDistanceSquaredMax: 500,
    touchTapDurationMaxMS: 300,
    motionOnRails: false,
    keepDragInBounds: false,
    ignoreDragOutOfBounds: false,
}

interface ISlideGridProps {
    /**
     * CSS class name for the main element.
     */
    className?: string;

    tuning?: ISlideGridTuning;

    /**
     * @param a key of the tile a user is interacting with
     * @param b key of the tile that might be exchanged with {a}
     * @returns {true} if {a} may be moved at all, and if given, may be exchanged with {b}
     */
    canExchange?(a: string, b?: string): boolean;

    /** the player has finished an interaction that did not result in a {tap} or {exchange} */
    done?(key: string): void;

    /** the player clicked or tapped on {key} */
    tap?(key: string): void;

    /** the player is dragging their finger across {key}, but not sliding anything */
    smear?(key: string): void;

    /** the player dragged {a} into {b}'s place, so their positions should be exchanged */
    exchange(a: string, b: string): void;
}

type EmptyLocation = {
    left: number;
    top: number;
};

interface ISlideGridState {
    active?: HTMLElement;
    emptyLocation?: EmptyLocation;
    location?: ILocation;
    wiggle?: boolean;
}

interface ILocation {
    timestamp: number;
    clientX: number;
    clientY: number;
    offsetX: number;
    offsetY: number;
}

type InputEventType = "down" | "move" | "up";

interface IInputEvent {
    kind: InputEventType;
    target: any;
    clientX: number;
    clientY: number;
    touchCount?: number;
}

/**
 * Immediate children must have the same "key" and "id" attributes:
 *  - key is used when dealing with the React side of things
 *  - id is used when manipulating the DOM.
 */
class SlideGrid extends React.Component<ISlideGridProps, ISlideGridState> {
    private lastInputEvent: IInputEvent = {} as any;
    private uniqueId: string;
    private tickHandle: any;
    private graph!: Graph;

    constructor(props: ISlideGridProps) {
        super(props);
        this.state = {};
        this.uniqueId = `slide-grid-${++SLIDE_GRID_INSTANCE_ID}`;
    }

    public render() {
        return <div id={this.uniqueId} className={compact([SLIDE_GRID, this.props.className, this.state.wiggle && WIGGLE]).join(" ")}
            onMouseDown={this.onMouseDown}
            onMouseMove={this.onMouseMove}
            onMouseUp={this.onMouseUp}>
            {this.children}
        </div>;
    }

    public componentDidMount() {
        // React's unified event system uses passive handlers which makes avoiding scroll-on-touch-drag impossible 
        const myDomElement = this.myDomElement;
        if (myDomElement) {
            myDomElement.addEventListener("touchstart", this.onTouchStart as any, { passive: false });
            myDomElement.addEventListener("touchmove", this.onTouchMove as any, { passive: false });
            myDomElement.addEventListener("touchend", this.onTouchEnd as any, { passive: false });
            myDomElement.addEventListener("touchcancel", this.onTouchEnd as any, { passive: false });
        } else {
            console.warn(`Couldn't find myself in the DOM, touch support unavailable. (id: ${this.uniqueId})`);
        }
        this.tickHandle = setInterval(this.tick, 100);
        this.buildGraph();
    }

    public componentWillUnmount() {
        const tickHandle = this.tickHandle;
        if (tickHandle !== undefined) {
            this.tickHandle = undefined;
            clearInterval(this.tickHandle);
        }
    }

    private get myDomElement()  {
        return document.getElementById(this.uniqueId);
    }

    /** the list of our React children. */
    private get children(): any[] {
        return (this.props.children || []) as any[];
    }

    /** the list of the React keys of our {children}. */
    private get keys(): string[] {
        return this.children.map((child) => child.key);
    }

    /** the list of DOM elements which are the visual manifestations of our React {children}. */
    private get childElements(): HTMLElement[] {
        return compact(this.keys.map((e) => document.getElementById(e)));
    }

    private get tuning(): ISlideGridTuning {
        return this.props.tuning || DEFAULT_TUNING;
    }

    /** thunk — default behavior: any pair may be picked up or exchanged */
    private canExchange = (a: string, b?: string): boolean => {
        const {canExchange} = this.props;
        if (canExchange === undefined) {
            return true;
        }
        return canExchange(a, b);
    };

    /** thunk — default behavior: no-op */
    private done = (key: string) => {
        const {done} = this.props;
        if (done === undefined) {
            return;
        }
        return done(key);
    };

    /** thunk — default behavior: no-op */
    private tap = (key: string) => {
        const {tap} = this.props;
        if (tap === undefined) {
            return;
        }
        return tap(key);
    };

    /** thunk — default behavior: no-op */
    private smear = (key: string) => {
        const {smear} = this.props;
        if (smear === undefined) {
            return;
        }
        return smear(key);
    };

    /** thunk */
    private exchange = (a: string, b: string) => {
        const {exchange} = this.props;
        exchange(a, b);
    };

    /** detects long-presses: a long touch where the touch doesn't move enough to start a drag. */
    private tick = () => {
        const {active, location} = this.state;
        if (active && this.lastInputEvent.touchCount !== undefined && location && (Date.now() - location.timestamp) > 300) {
            let isDragging = active.classList.contains(DRAGGING);
            if (!isDragging && this.canExchange(active.id)) {
                this.setState({wiggle: true});
            }
        }
    }

    /** @returns the child under the given event, passing through the actively-dragged child, if any */
    private getTarget = (event: IInputEvent): HTMLElement | undefined => {
        let target: any = event.target;
        // bubble-up until we find a direct child
        while (target && !this.keys.includes(target.id)) {
            target = target.parentElement;
        }
        const x = event.clientX;
        const y = event.clientY;
        if (target && this.state.active === target) {
            const otherTarget = this.childElements.find((element) => {
                if (element === target) {
                    return false;
                }
                const rect = element.getBoundingClientRect();
                const elementLeft = rect.left;
                const elementTop = rect.top;
                const elementRight = rect.right;
                const elementBottom = rect.bottom;
                return (
                    x > elementLeft &&
                    x < elementRight &&
                    y > elementTop &&
                    y < elementBottom);
            });
            if (otherTarget) {
                return otherTarget;
            }
        }
        return target;
    }

    public componentDidUpdate(prevProps: ISlideGridProps, prevState: ISlideGridState) {
        const target = this.state.active;
        const location = this.state.location;
        const emptyLocation = this.state.emptyLocation;
        // After an exchange, make sure we know the new location of the dragged child,
        // then update its transform so it appears that it hasn't moved from under the cursor.
        if (target && location && emptyLocation) {
            target.style.transform = null;
            const rect = target.getBoundingClientRect();
            if (rect.left.toFixed(0) !== emptyLocation.left.toFixed(0)
                || rect.top.toFixed(0) !== emptyLocation.top.toFixed(0)) {
                const newEmptyLocation = {
                    left: rect.left,
                    top: rect.top,
                }
                const newState = {
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
        console.log(this.lastInputEvent);
        if (this.lastInputEvent.kind === "move") {
            this.onMouseOrTouchMove(this.lastInputEvent, true);
        }
    }

    private buildGraph = () => {
        const graph = new Graph();
        this.keys.forEach((a, aIndex, keys) => {
            const neighbors: {[key: string]: number} = {};
            keys.forEach((b) => {
                if (a === b) {
                    return;
                }
                if (this.canExchange(a, b)) {
                    neighbors[b] = 1;
                }
            });
            graph.addNode(a, neighbors);
        });
        this.graph = graph;
    }

    private onMouseDown = (event: React.MouseEvent<any, MouseEvent>) => {
        this.lastInputEvent = { kind: "down", ...event };
        this.onMouseOrTouchDown(this.lastInputEvent);
    }

    private onMouseMove = (event: React.MouseEvent<any, MouseEvent>) => {
        this.lastInputEvent = { kind: "move", ...event };
        this.onMouseOrTouchMove(this.lastInputEvent);
    }

    private onMouseUp = (event: React.MouseEvent<any, MouseEvent>) => {
        this.lastInputEvent = { kind: "up", ...event };
        this.onMouseOrTouchUp(this.lastInputEvent);
    }

    private onMouseOrTouchDown = (event: IInputEvent) => {
        const target = this.getTarget(event);
        if (target) {
            const rect = target.getBoundingClientRect();
            const emptyLocation = {
                left: rect.left,
                top: rect.top,
            }
            this.setState({
                active: target,
                emptyLocation,
                location: {
                    timestamp: Date.now(),
                    clientX: event.clientX,
                    clientY: event.clientY,
                    offsetX: event.clientX - rect.left,
                    offsetY: event.clientY - rect.top,
                },
            });
            setTimeout(() => {
                if (this.state.active === target && !target.classList.contains(DRAGGING) && this.canExchange(target.id)) {
                    target.classList.add(PRE_DRAGGING);
                }
            }, 100);
        }
    }

    private onMouseOrTouchMove = (event: IInputEvent, onlyUpdateActive: boolean = false) => {
        const target = !onlyUpdateActive && this.getTarget(event);
        const { active, emptyLocation, location: activeLocation } = this.state;
        if (!active || !activeLocation) {
            return;
        }
        let canDrag = event.touchCount === undefined || event.touchCount > 1 || this.state.wiggle;
        let dx = event.clientX - activeLocation.clientX;
        let dy = event.clientY - activeLocation.clientY;
        if (canDrag && this.tuning.ignoreDragOutOfBounds) {
            const bounds = active.parentElement!.getBoundingClientRect();
            const activeBounds = active.getBoundingClientRect();
            if (activeBounds.left + dx < bounds.left ||
                activeBounds.top + dy < bounds.top ||
                activeBounds.right + dx > bounds.right ||
                activeBounds.bottom + dy > bounds.bottom) {
                return;
            }
        }
        if (canDrag) {
            let isDragging = active.classList.contains(DRAGGING);
            const d2 = dx * dx + dy * dy;
            if (!isDragging && d2 > this.tuning.dragStartDistanceSquared) {
                if (this.canExchange(active.id)) {
                    active.classList.add(DRAGGING);
                    isDragging = true;
                }
            }
            if (isDragging) {
                if (this.tuning.motionOnRails) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        dy = 0;
                    } else {
                        dx = 0;
                    }
                }
                if (this.tuning.keepDragInBounds) {
                    const bounds = active.parentElement!.getBoundingClientRect();
                    const activeBounds = active.getBoundingClientRect();
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
                active.classList.remove(PRE_DRAGGING);
                active.style.transform = `translate(${dx}px,${dy}px)`;
                if (target) {
                    if (target === active) {
                        return;
                    }
                    const path: string[] | undefined = this.graph.path(active.id, target.id);
                    if (!path) {
                        return;
                    }
                    // pop active node off the path
                    path.shift();
                    if (path.find((bKey) => {
                        const b = document.getElementById(bKey)!;
                        return b.classList.contains(SLIDING);
                    })) {
                        return;
                    }
                    console.log(path.join());
                    let newLocation = emptyLocation!
                    while (path.length > 0) {
                        const exchangeTarget = document.getElementById(path.shift()!)!;
                        const er = exchangeTarget.getBoundingClientRect();
                        const emptyLeft = newLocation.left;
                        const emptyTop = newLocation.top;
                        const sdx = emptyLeft - er.left;
                        const sdy = emptyTop - er.top;
                        newLocation = er;
                        exchangeTarget.classList.add(SLIDING);
                        exchangeTarget.style.transform = `translate(${sdx}px,${sdy}px)`;
                        exchangeTarget.style.transition = `all ${this.tuning.slideDurationMS}ms ease-in-out`;
                        const a = active.id;
                        const b = exchangeTarget.id;
                        setTimeout(() => {
                            exchangeTarget.classList.remove(SLIDING);
                            exchangeTarget.style.transform = null;
                            exchangeTarget.style.transition = "";
                            this.exchange(a, b);
                        }, this.tuning.slideDurationMS);
                    }
                }
            }
        } else if (target) { // touching something
            const targetX = (target.getBoundingClientRect().left + target.getBoundingClientRect().right) / 2;
            const targetY = (target.getBoundingClientRect().top + target.getBoundingClientRect().bottom) / 2;
            let dx = Math.abs(event.clientX - targetX);
            let dy = Math.abs(event.clientY - targetY);
            const d2 = dx * dx + dy * dy;
            if (target === active ? d2 > this.tuning.smearDistanceSquaredMin : d2 < this.tuning.smearDistanceSquaredMax) {
                this.smear(target.id);
            }
        }
    }

    private onMouseOrTouchUp = (event: IInputEvent) => {
        const target = this.getTarget(event);
        const state = this.state;
        let click: string;
        let done: string;
        if (state.active) {
            done = state.active.id;
            state.active.classList.remove(PRE_DRAGGING);
            if (state.active.classList.contains(DRAGGING)) {
                state.active.classList.remove(DRAGGING);
            } else if (event.touchCount === undefined) {
                click = state.active.id;
            } else if (target === state.active && state.location) {
                const dt = Date.now() - state.location.timestamp;
                if (dt < this.tuning.touchTapDurationMaxMS) {
                    click = state.active.id;
                }
            }
            state.active.style.transform = null;
        }
        this.setState({ active: undefined, location: undefined, wiggle: false }, () => {
            if (click) {
                this.tap(click);
            } else {
                this.done(done);
            }
        });
    }

    private onTouchStart = (event: TouchEvent) => {
        this.onMouseOrTouchDown(this.recordTouch("down", event))
    }

    private onTouchMove = (event: TouchEvent) => {
        this.onMouseOrTouchMove(this.recordTouch("move", event))
    }

    private onTouchEnd = (event: TouchEvent) => {
        this.onMouseOrTouchUp(this.recordTouch("up", event));
    }

    private recordTouch = (kind: InputEventType, event: TouchEvent) => {
        event.preventDefault(); // prevents generation of mouse events 
        const touchCount = event.touches.length;
        let clientX = 0;
        let clientY = 0;
        for (let i = 0; i < touchCount; ++i) {
            clientX += event.touches[i].clientX;
            clientY += event.touches[i].clientY;
        }
        clientX /= touchCount;
        clientY /= touchCount;
        this.lastInputEvent = { kind, target: event.target, clientX, clientY, touchCount }
        console.log(this.lastInputEvent);
        return this.lastInputEvent;
    }
}

export default SlideGrid;
