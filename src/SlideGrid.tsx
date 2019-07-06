import * as React from "react";
import compact from "lodash/compact";
import "./SlideGrid.css";

let SLIDE_GRID_INSTANCE_ID = 0;

interface ISlideGridProps {
    /**
     * CSS class name for the main element.
     */
    className?: string;

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

interface ISlideGridState {
    active?: HTMLElement;
    emptyLocation?: { left: number, top: number };
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

interface IInputEvent {
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

    constructor(props: ISlideGridProps) {
        super(props);
        this.state = {};
        this.uniqueId = `slide-grid-${++SLIDE_GRID_INSTANCE_ID}`;
    }

    public render() {
        return <div id={this.uniqueId} className={compact(["slide-grid", this.props.className, this.state.wiggle && "wiggle"]).join(" ")}
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

    private get children(): any[] {
        return (this.props.children || []) as any[];
    }

    private get childElements(): HTMLElement[] {
        return compact(this.keys.map((e) => document.getElementById(e)));
    }

    private get keys(): string[] {
        return this.children.map((child) => child.key);
    }

    private canExchange = (a: string, b?: string): boolean => {
        const {canExchange} = this.props;
        if (canExchange === undefined) {
            return true;
        }
        return canExchange(a, b);
    };

    private done = (key: string) => {
        const {done} = this.props;
        if (done === undefined) {
            return;
        }
        return done(key);
    };

    private tap = (key: string) => {
        const {tap} = this.props;
        if (tap === undefined) {
            return;
        }
        return tap(key);
    };

    private smear = (key: string) => {
        const {smear} = this.props;
        if (smear === undefined) {
            return;
        }
        return smear(key);
    };

    private exchange = (a: string, b: string) => {
        const {exchange} = this.props;
        exchange(a, b);
    };

    private tick = () => {
        const {active, location} = this.state;
        if (active && this.lastInputEvent.touchCount !== undefined && location && (Date.now() - location.timestamp) > 300) {
            let isDragging = active.classList.contains("dragging");
            if (!isDragging && this.canExchange(active.id)) {
                this.setState({wiggle: true});
            }
        }
    }

    private getTarget = (event: IInputEvent): HTMLElement | undefined => {
        let target: any = event.target;
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
            }
        }
    }

    private onMouseDown = (event: React.MouseEvent<any, MouseEvent>) => {
        this.onMouseOrTouchDown(event);
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
                if (this.state.active === target && !target.classList.contains("dragging") && this.canExchange(target.id)) {
                    target.classList.add("pre-dragging");
                }
            }, 100);
        }
    }

    private onMouseMove = (event: React.MouseEvent<any, MouseEvent>) => {
        this.onMouseOrTouchMove(event);
    }

    private onMouseOrTouchMove = (event: IInputEvent) => {
        const target = this.getTarget(event);
        const { active, emptyLocation, location: activeLocation } = this.state;
        if (!active || !activeLocation) {
            return;
        }
        const canDrag = event.touchCount === undefined || event.touchCount > 1 || this.state.wiggle;
        if (canDrag) {
            let isDragging = active.classList.contains("dragging");
            let dx = event.clientX - activeLocation.clientX;
            let dy = event.clientY - activeLocation.clientY;
            const d2 = dx * dx + dy * dy;
            if (!isDragging && d2 > 9) {
                if (this.canExchange(active.id)) {
                    active.classList.add("dragging");
                    active.style.zIndex = "1";
                    isDragging = true;
                }
            }
            if (isDragging) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    dy = 0;
                } else {
                    dx = 0;
                }
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
                active.classList.remove("pre-dragging");
                active.style.transform = `translate(${dx}px,${dy}px)`;
                if (target) {
                    const sliding = target.classList.contains("sliding");
                    if (target !== active && !sliding && this.canExchange(target.id, active.id)) {
                        const er = target.getBoundingClientRect();
                        const emptyLeft = emptyLocation!.left;
                        const emptyTop = emptyLocation!.top;
                        const sdx = emptyLeft - er.left;
                        const sdy = emptyTop - er.top;
                        target.classList.add("sliding");
                        target.style.transform = `translate(${sdx}px,${sdy}px)`;
                        target.style.transition = `all 0.1s ease-in-out`;
                        const a = active.id;
                        const b = target.id;
                        setTimeout(() => {
                            target.classList.remove("sliding");
                            target.style.transform = null;
                            target.style.transition = "";
                            this.exchange(a, b);
                        }, 10);
                    }
                }
            }
        } else if (target) { // touching something
            const targetX = (target.getBoundingClientRect().left + target.getBoundingClientRect().right) / 2;
            const targetY = (target.getBoundingClientRect().top + target.getBoundingClientRect().bottom) / 2;
            let dx = Math.abs(event.clientX - targetX);
            let dy = Math.abs(event.clientY - targetY);
            const d2 = dx * dx + dy * dy;
            if (target === active ? d2 > 20 : d2 < 500) {
                this.smear(target.id);
            }
        }
    }

    private onMouseUp = (event: React.MouseEvent<any, MouseEvent>) => {
        this.onMouseOrTouchUp(event);
    }

    private onMouseOrTouchUp = (event: IInputEvent) => {
        const target = this.getTarget(event);
        const state = this.state;
        let click: string;
        let done: string;
        if (state.active) {
            done = state.active.id;
            state.active.classList.remove("pre-dragging");
            if (state.active.classList.contains("dragging")) {
                state.active.classList.remove("dragging");
            } else if (event.touchCount === undefined) {
                click = state.active.id;
            } else if (target === state.active && state.location) {
                const dt = Date.now() - state.location.timestamp;
                if (dt < 300) {
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
        event.preventDefault(); // prevents generation of mouse events 
        this.recordTouch(event);
        this.onMouseOrTouchDown(this.lastInputEvent)
    }

    private onTouchMove = (event: TouchEvent) => {
        event.preventDefault(); // prevents generation of mouse events 
        this.recordTouch(event);
        this.onMouseOrTouchMove(this.lastInputEvent)
    }

    private onTouchEnd = (event: TouchEvent) => {
        event.preventDefault(); // prevents generation of mouse events 
        this.recordTouch(event);
        this.onMouseOrTouchUp(this.lastInputEvent);
    }

    private recordTouch = (event: TouchEvent) => {
        const touchCount = event.touches.length;
        let clientX = 0;
        let clientY = 0;
        for (let i = 0; i < touchCount; ++i) {
            clientX += event.touches[i].clientX;
            clientY += event.touches[i].clientY;
        }
        clientX /= touchCount;
        clientY /= touchCount;
        this.lastInputEvent = { target: event.target, clientX, clientY, touchCount };
    }
}

export default SlideGrid;
