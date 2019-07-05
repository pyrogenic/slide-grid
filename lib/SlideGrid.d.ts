import * as React from "react";
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
    constructor(props: ISlideGridProps);
    render(): JSX.Element;
    componentDidMount(): void;
    componentWillUnmount(): void;
    private readonly myDomElement;
    private readonly children;
    private readonly childElements;
    private readonly keys;
    private canExchange;
    private done;
    private tap;
    private smear;
    private exchange;
    private tick;
    private getTarget;
    componentDidUpdate(prevProps: ISlideGridProps, prevState: ISlideGridState): void;
    private onMouseDown;
    private onMouseOrTouchDown;
    private onMouseMove;
    private onMouseOrTouchMove;
    private onMouseUp;
    private onMouseOrTouchUp;
    private onTouchStart;
    private onTouchMove;
    private onTouchEnd;
    private recordTouch;
}
export default SlideGrid;