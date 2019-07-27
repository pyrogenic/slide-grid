import * as React from "react";
import "./SlideGrid.css";
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
export declare const DEFAULT_TUNING: ISlideGridTuning;
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
interface ISlideGridState {
    active?: HTMLElement;
    emptyLocation?: {
        left: number;
        top: number;
    };
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
/**
 * Immediate children must have the same "key" and "id" attributes:
 *  - key is used when dealing with the React side of things
 *  - id is used when manipulating the DOM.
 */
declare class SlideGrid extends React.Component<ISlideGridProps, ISlideGridState> {
    private lastInputEvent;
    private uniqueId;
    private tickHandle;
    private graph;
    constructor(props: ISlideGridProps);
    render(): JSX.Element;
    componentDidMount(): void;
    componentWillUnmount(): void;
    private readonly myDomElement;
    /** the list of our React children. */
    private readonly children;
    /** the list of the React keys of our {children}. */
    private readonly keys;
    /** the list of DOM elements which are the visual manifestations of our React {children}. */
    private readonly childElements;
    private readonly tuning;
    /** thunk — default behavior: any pair may be picked up or exchanged */
    private canExchange;
    /** thunk — default behavior: no-op */
    private done;
    /** thunk — default behavior: no-op */
    private tap;
    /** thunk — default behavior: no-op */
    private smear;
    /** thunk */
    private exchange;
    /** detects long-presses: a long touch where the touch doesn't move enough to start a drag. */
    private tick;
    /** @returns the child under the given event, passing through the actively-dragged child, if any */
    private getTarget;
    componentDidUpdate(prevProps: ISlideGridProps, prevState: ISlideGridState): void;
    private buildGraph;
    private onMouseDown;
    private onMouseMove;
    private onMouseUp;
    private onMouseOrTouchDown;
    private onMouseOrTouchMove;
    private onMouseOrTouchUp;
    private onTouchStart;
    private onTouchMove;
    private onTouchEnd;
    private recordTouch;
}
export default SlideGrid;
