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
// const PRE_DRAGGING = "pre-dragging";

/** CSS classname of the object being dragged under the cursor */
const DRAGGING = "dragging";

/** CSS classname added to a child while it is animating to where it should be after an exchange but before {exchange} is actually called */
const SLIDING = "sliding";

export interface ISlideGridTuning {
    dragStartDistanceSquared: number;
    slideDurationMS: number;
    smearDistanceSquaredMin: number;
    smearDistanceSquaredMax: number;
    longPressDurationMS: number;
    motionOnRails: boolean;
    keepDragInBounds: boolean;
    ignoreDragOutOfBounds: boolean;
}

export const DEFAULT_TUNING: ISlideGridTuning = {
    dragStartDistanceSquared: 9,
    slideDurationMS: 100,
    smearDistanceSquaredMin: 900,
    smearDistanceSquaredMax: 625,
    longPressDurationMS: 300,
    motionOnRails: false,
    keepDragInBounds: false,
    ignoreDragOutOfBounds: false,
}

interface ISlideGridProps {
    /**
     * CSS class name for the main element.
     */
    className?: string;
    
    /**
     * CSS styles for the main element.
     */
    style?: Partial<React.CSSProperties>;

    tuning?: Partial<ISlideGridTuning>;

    /**
     * An optional list of keys to use instead of the keys of our immediate children.
     */
    keys?: string[];

    /**
     * @param a key of the tile a user is interacting with
     * @param b key of the tile that might be exchanged with {a}
     * @returns {true} if {a} may be moved at all, and if given, may be exchanged with {b}
     */
    canExchange?(a: string, b?: string): boolean | number;

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
    parentX: number;
    parentY: number;
};

interface ISlideGridState {
    tuning: ISlideGridTuning;
    active?: string;
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
    parentX: number;
    parentY: number;
}

type InputEventType = "down" | "move" | "up";

interface IInputEvent {
    kind: InputEventType;
    target: any;
    clientX: number;
    clientY: number;
    touchCount?: number;
}

const DRAGGING_STYLE_TRANSFORM = "scale(1.25)";

/**
 * Immediate children must have the same "key" and "id" attributes:
 *  - key is used when dealing with the React side of things
 *  - id is used when manipulating the DOM.
 */
class SlideGrid extends React.Component<ISlideGridProps, ISlideGridState> {
    private lastInputEvent?: IInputEvent;
    private uniqueId: string;
    private graph!: Graph;
    private lastSmear?: string;
    private onTick?: ()=> void;
    private tickHandle?: NodeJS.Timeout;
    
    constructor(props: ISlideGridProps) {
        super(props);
        this.state = SlideGrid.getDerivedStateFromProps(props);
        this.uniqueId = `slide-grid-${++SLIDE_GRID_INSTANCE_ID}`;
        if (this.onTick) {
            this.tickHandle = setInterval(this.onTick, 1);
        }
    }
    
    //lastActive: HTMLElement | null | undefined;
    // private onTick = () => {
    //     if (this.lastActive != this.active) {
    //         console.log({ lastActive: this.lastActive, active: this.active });
    //     }
    //     this.active?.classList.add(DRAGGING);
    //     this.lastActive = this.active;
    // };


    public static getDerivedStateFromProps(nextProps: Readonly<ISlideGridProps>, prevState?: ISlideGridState) {
        return { ...prevState, tuning: { ...DEFAULT_TUNING, ...nextProps.tuning } };
    }

    public render() {
        // if (this.active?.classList.contains(DRAGGING)) {
        //     console.log({active: this.active});
        //     setTimeout(() => {
        //         this.active?.classList.add(DRAGGING);
        //         console.log({activePost: this.active});
        //     }, 1);
        // }
        return <div 
            id={this.uniqueId}
             className={compact([SLIDE_GRID, this.props.className, this.state.wiggle && WIGGLE]).join(" ")}
             style={this.props.style}
            onMouseDown={this.onMouseDown}
            onMouseMove={this.onMouseMove}
            onMouseUp={this.onMouseUp}>
            {this.props.children}
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

    /** the list of the React keys of our {children}. */
    private get keys(): string[] {
        if (this.props.keys) {
            return this.props.keys;
        }
        return (this.props.children as React.ReactElement[]).map((child) => child.key as string);
    }

    /** the list of DOM elements which are the visual manifestations of our React {children}. */
    private get childElements(): HTMLElement[] {
        const result = compact(this.keys.map((e) => document.getElementById(e)));
        return result;
    }

    private get tuning(): ISlideGridTuning {
        return this.state.tuning;
    }

    /** thunk — default behavior: any pair may be picked up or exchanged */
    private canExchange = (a: string, b?: string): boolean | number => {
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

    /** @returns the child under the given event, passing through the actively-dragged child, if any */
    private getTarget = (event: IInputEvent): HTMLElement | undefined => {
        let target: any = event.target;
        // bubble-up until we find a direct child
        while (target && !this.keys.includes(target.id)) {
            target = target.parentElement;
        }
        const x = event.clientX;
        const y = event.clientY;
        if (target && (sameElement(this.active, target) || !elementContainsPoint(target, x, y))) {
            var insideActive = false;
            const otherTarget = this.childElements.find((element) => {
                const inside = elementContainsPoint(element, x, y);
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
    }

    private get active() {
        const {active: activeId} = this.state;
        if (!activeId) {
            return undefined;
        }
        const active = document.getElementById(activeId);
        if (!active) {
            console.warn(`Bad active: ${activeId}`);
        }
        return active;
    }

    public componentDidUpdate(prevProps: ISlideGridProps, prevState: ISlideGridState) {
        const active = this.active;
        const location = this.state.location;
        const emptyLocation = this.state.emptyLocation;
        // After an exchange, make sure we know the new location of the dragged child,
        // then update its transform so it appears that it hasn't moved from under the cursor.
        if (active && location && emptyLocation && active.classList.contains(DRAGGING)) {
            active.style.transform = "";
            const rect = active.getBoundingClientRect();
            active.style.transform = DRAGGING_STYLE_TRANSFORM;
            if (rect.left.toFixed(0) !== emptyLocation.left.toFixed(0)
            || rect.top.toFixed(0) !== emptyLocation.top.toFixed(0)) {
                const newEmptyLocation = {
                    left: rect.left,
                    top: rect.top,
                    parentX: active.parentElement!.offsetLeft, 
                    parentY: active.parentElement!.offsetTop, 
                }
                const newState = {
                    emptyLocation: newEmptyLocation,
                    location: {
                        timestamp: location.timestamp,
                        clientX: newEmptyLocation.left + location.offsetX,
                        clientY: newEmptyLocation.top + location.offsetY,
                        offsetX: location.offsetX,
                        offsetY: location.offsetY,
                        parentX: newEmptyLocation.parentX,
                        parentY: newEmptyLocation.parentY,
                    },
                };
                // console.log("newEmptyLocation");
                // console.log(newEmptyLocation);
                this.setState(newState);
                return;
            }
        }
        this.buildGraph();
        if (this.lastInputEvent?.kind === "move") {
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
                const cost = this.canExchange(a, b);
                if (cost !== false) {
                    neighbors[b] = cost === true ? 1 : cost;
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
            const parentX = target.parentElement!.offsetLeft;
            const parentY = target.parentElement!.offsetTop;
            const emptyLocation: any = {
                left: rect.left,
                top: rect.top,
                // parentX,
                // parentY,
            };
            const downEventX = event.clientX;
            const downEventY = event.clientY;
            const touching = event.touchCount !== undefined;
            //console.log({touching});
            this.lastSmear = undefined;
            this.setState({
                active: target.id,
                emptyLocation,
                location: {
                    timestamp: Date.now(),
                    clientX: downEventX,
                    clientY: downEventY,
                    offsetX: downEventX - rect.left,
                    offsetY: downEventY - rect.top,
                    parentX: parentX,
                    parentY: parentY,
                },
            });
            setTimeout(() => {
                const active = this.active;
                if (!sameElement(active, target)) {
                    return;
                }
                if (touching && this.props.smear && this.lastInputEvent) {
                    const lastEventX = this.lastInputEvent.clientX;
                    const lastEventY = this.lastInputEvent.clientY;
                    let dx = Math.abs(downEventX - lastEventX);
                    let dy = Math.abs(downEventY - lastEventY);
                    const d2 = dx * dx + dy * dy;
                    if (d2 > this.tuning.smearDistanceSquaredMin) {
                        //console.log("Moved too far with touch — smearing instead of bulging");
                        return;
                    }
                }
                if (sameElement(active, target) && !target.classList.contains(DRAGGING) && this.canExchange(target.id) !== false) {
                    target.classList.add(DRAGGING);
                    target.style.transform = DRAGGING_STYLE_TRANSFORM;
                }
            }, this.tuning.longPressDurationMS);
        }
    }

    private onMouseOrTouchMove = (event: IInputEvent, onlyUpdateActive: boolean = false) => {
        const target = !onlyUpdateActive && this.getTarget(event);
        const active = this.active;
        const { emptyLocation, location: activeLocation } = this.state;
        if (!active || !activeLocation) {
            return;
        }
        const activeIsDragging = active.classList.contains(DRAGGING);
        let canDrag = event.touchCount === undefined || event.touchCount > 1 || activeIsDragging;
        // console.log({ onlyUpdateActive, target: target && target.id, active: active.id,
        //     // activeIsDragging, canDrag,
        //     x: event.clientX, y: event.clientY,
        //      });
        let dx = event.clientX - activeLocation.clientX;// - activeLocation.parentX + ;
        let dy = event.clientY - activeLocation.clientY;// - activeLocation.parentY + active.parentElement!.offsetTop;
        let parentOffsetX = active.parentElement!.offsetLeft - activeLocation.parentX;
        let parentOffsetY = active.parentElement!.offsetTop - activeLocation.parentY;
        dx -= parentOffsetX;
        dy -= parentOffsetY;
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
                if (this.canExchange(active.id) !== false) {
                    // Start dragging active
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
                const newTransform = `translate(${dx}px,${dy}px) ${DRAGGING_STYLE_TRANSFORM}`;
                active.style.transform = newTransform;
                if (target) {
                    if (target === active) {
                        return;
                    }
                    const pathOrResult = this.graph.path(active.id, target.id);
                    var path: string[] | undefined;
                    if (Array.isArray(pathOrResult)) {
                        path = pathOrResult;
                    } else {
                        path = pathOrResult?.path;
                    }
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
                    let newLocation = emptyLocation!
                    while (path.length > 0) {
                        const exchangeTarget = document.getElementById(path.shift()!)!;
                        const exchangeTargetRect = exchangeTarget.getBoundingClientRect();
                        const exchangeTargetParentX = exchangeTarget.parentElement!.offsetLeft;
                        const exchangeTargetParentY = exchangeTarget.parentElement!.offsetTop;
                        const emptyLeft = newLocation.left;
                        const emptyTop = newLocation.top;
                        const sdx = emptyLeft - exchangeTargetRect.left - newLocation.parentX + exchangeTargetParentX;
                        const sdy = emptyTop - exchangeTargetRect.top - newLocation.parentY + exchangeTargetParentY;
                        newLocation = { 
                            left: exchangeTargetRect.left, 
                            top: exchangeTargetRect.top, 
                            parentX: exchangeTargetParentX,
                            parentY: exchangeTargetParentY,
                        };
                        exchangeTarget.classList.add(SLIDING);
                        exchangeTarget.style.transform = `translate(${sdx}px,${sdy}px)`;
                        exchangeTarget.style.transition = `all ${this.tuning.slideDurationMS}ms ease-in-out`;
                        const a = active.id;
                        const b = exchangeTarget.id;
                        setTimeout(() => {
                            exchangeTarget.classList.remove(SLIDING);
                            exchangeTarget.style.transform = "";
                            exchangeTarget.style.transition = "";
                            this.exchange(a, b);
                        }, this.tuning.slideDurationMS);
                    }
                }
            }
            return;
        }
        if (onlyUpdateActive) {
            return;
        }
        // touching something
        if (target && this.props.smear && target.id !== this.lastSmear) {
            const targetX = (target.getBoundingClientRect().left + target.getBoundingClientRect().right) / 2;
            const targetY = (target.getBoundingClientRect().top + target.getBoundingClientRect().bottom) / 2;
            let dx = Math.abs(event.clientX - targetX);
            let dy = Math.abs(event.clientY - targetY);
            const d2 = dx * dx + dy * dy;
            if (target === active ? d2 > this.tuning.smearDistanceSquaredMin : d2 < this.tuning.smearDistanceSquaredMax) {
                // console.log(`smear from ${this.lastSmear} --> ${target.id} (d2: ${d2}, active: ${active?.id ?? undefined})`);
                this.lastSmear = target.id;
                this.smear(target.id);
            }
        }
    }

    private onMouseOrTouchUp = (event: IInputEvent) => {
        const target = this.getTarget(event);
        const state = this.state;
        let click: string;
        let done: string;
        const active = this.active;
        if (active) {
            if (active.classList.contains(DRAGGING)) {
                active.classList.remove(DRAGGING);
            } else if (event.touchCount === undefined) {
                click = active.id;
            } else if (target?.id === active.id && state.location) {
                const dt = Date.now() - state.location.timestamp;
                if (dt < this.tuning.longPressDurationMS) {
                    click = active.id;
                } else {
                    done = active.id;
                }
            } else {
                done = active.id;
            }
            active.style.transform = "";
        }
        this.setState({ active: undefined, location: undefined, wiggle: false }, () => {
            if (click) {
                this.tap(click);
            } else if (done) {
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
        let clientX = 0;
        let clientY = 0;
        const touchCount = event.touches.length;
        if (touchCount) {

            for (let i = 0; i < touchCount; ++i) {
                clientX += event.touches[i].clientX;
                clientY += event.touches[i].clientY;
            }
            clientX /= touchCount;
            clientY /= touchCount;
        } else if (this.lastInputEvent) {
            clientX = this.lastInputEvent.clientX;
            clientY = this.lastInputEvent.clientY;
        }
        this.lastInputEvent = {kind, target: event.target, clientX, clientY, touchCount};
        return this.lastInputEvent;
    }
}

export default SlideGrid;

function sameElement(a: HTMLElement | null | undefined, b: HTMLElement | null | undefined) {
    return a?.id === b?.id;
}

function elementContainsPoint(element: HTMLElement, x: number, y: number) {
    const rect = element.getBoundingClientRect();
    const elementLeft = rect.left;
    const elementTop = rect.top;
    const elementRight = rect.right;
    const elementBottom = rect.bottom;
    const inside = (
        x > elementLeft &&
        x < elementRight &&
        y > elementTop &&
        y < elementBottom);
    return inside;
}

