import { EventEmitter } from './EventEmitter';

export class DragListener extends EventEmitter {
    private _timeout: NodeJS.Timeout | undefined;
    private _oDocument: Document;
    private _eBody: HTMLElement;
    private _nDelay: number;
    private _nDistance: number;
    private _nX: number;
    private _nY: number;
    private _nOriginalX: number;
    private _nOriginalY: number;
    private _bDragging: boolean;

    private _mouseDownEventListener = (ev: MouseEvent) => this.onMouseDown(ev);
    private _mouseMoveEventListener = (ev: MouseEvent) => this.onMouseMove(ev);
    private _mouseUpEventListener = (ev: MouseEvent) => this.onMouseUp(ev);

    private _touchStartEventListener = (ev: TouchEvent) => this.onTouchStart(ev);
    private _touchMoveEventListener = (ev: TouchEvent) => this.onTouchMove(ev);
    private _touchEndEventListener = (ev: TouchEvent) => this.onTouchEnd(ev);

    constructor(private _eElement: HTMLElement) {
        super();

        this._timeout = undefined;

        this._oDocument = document;
        this._eBody = document.body;

        /**
         * The delay after which to start the drag in milliseconds
         */
        this._nDelay = 200;

        /**
         * The distance the mouse needs to be moved to qualify as a drag
         */
        this._nDistance = 10; //TODO - works better with delay only

        this._nX = 0;
        this._nY = 0;

        this._nOriginalX = 0;
        this._nOriginalY = 0;

        this._bDragging = false;

        this._eElement.addEventListener('mousedown', this._mouseUpEventListener);
        this._eElement.addEventListener('touchstart', this._touchStartEventListener);
    }

    destroy(): void {
        this._eElement.removeEventListener('mousedown', this._mouseDownEventListener);
        this._eElement.removeEventListener('touchstart', this._touchStartEventListener);
        this._oDocument.removeEventListener('mouseup', this._mouseUpEventListener);
        this._oDocument.removeEventListener('touchend', this._touchEndEventListener);
    }

    private onMouseDown(oEvent: MouseEvent) {
        oEvent.preventDefault();

        if (oEvent.button == 0) {
            const coordinates = this.getMouseCoordinates(oEvent);
            this.processMouseDownTouchStart(coordinates);
        }
    }

    private onTouchStart(oEvent: TouchEvent) {
        oEvent.preventDefault();

        const coordinates = this.getTouchCoordinates(oEvent);
        if (coordinates !== undefined) {
            this.processMouseDownTouchStart(coordinates);
        }
    }

    private processMouseDownTouchStart(coordinates: DragProxy.MouseTouchCoordinates) {
        this._nOriginalX = coordinates.x;
        this._nOriginalY = coordinates.y;

        this._oDocument.addEventListener('mousemove', this._mouseMoveEventListener);
        this._oDocument.addEventListener('touchmove', this._touchMoveEventListener);
        this._eElement.addEventListener('mouseup', this._mouseUpEventListener);
        this._eElement.addEventListener('touchend', this._touchEndEventListener);

        this._timeout = setTimeout(() => this.startDrag(), this._nDelay);
    }

    private onMouseMove(oEvent: MouseEvent) {
        if (this._timeout !== undefined) {
            oEvent.preventDefault();

            const coordinates = this.getMouseCoordinates(oEvent);
            const dragEvent: EventEmitter.DragEvent = {
                mouseEvent: oEvent,
                touchEvent: undefined,
                pageX: coordinates.x,
                pageY: coordinates.y,
            }
            this.processDragMove(dragEvent);
        }
    }

    private onTouchMove(oEvent: TouchEvent) {
        if (this._timeout !== undefined) {
            oEvent.preventDefault();

            const coordinates = this.getTouchCoordinates(oEvent);
            if (coordinates !== undefined) {
                const dragEvent: EventEmitter.DragEvent = {
                    mouseEvent: undefined,
                    touchEvent: oEvent,
                    pageX: coordinates.x,
                    pageY: coordinates.y,
                }
                this.processDragMove(dragEvent);
            }
        }
    }

    private processDragMove(dragEvent: EventEmitter.DragEvent) {
        this._nX = dragEvent.pageX - this._nOriginalX;
        this._nY = dragEvent.pageY - this._nOriginalY;

        if (this._bDragging === false) {
            if (
                Math.abs(this._nX) > this._nDistance ||
                Math.abs(this._nY) > this._nDistance
            ) {
                if (this._timeout !== undefined) {
                    clearTimeout(this._timeout);
                }
                this.startDrag();
            }
        }

        if (this._bDragging) {
            this.emit('drag', this._nX, this._nY, dragEvent);
        }
    }

    private onMouseUp(oEvent: MouseEvent) {
        const coordinates = this.getMouseCoordinates(oEvent);
        const dragEvent: EventEmitter.DragEvent = {
            mouseEvent: oEvent,
            touchEvent: undefined,
            pageX: coordinates.x,
            pageY: coordinates.y,
        }
        this.processDragStop(dragEvent);
    }

    private onTouchEnd(oEvent: TouchEvent): void {
        let coordinates = this.getTouchCoordinates(oEvent);
        if (coordinates === undefined) {
            // not sure what else to do here
            coordinates = {
                x: this._nOriginalX,
                y: this._nOriginalY,
            };
        }
        const dragEvent: EventEmitter.DragEvent = {
            mouseEvent: undefined,
            touchEvent: oEvent,
            pageX: coordinates.x,
            pageY: coordinates.y,
        }
        this.processDragStop(dragEvent);
    }

    private processDragStop(dragEvent: EventEmitter.DragEvent) {
        if (this._timeout != null) {
            clearTimeout(this._timeout);
            this._eBody.classList.remove('lm_dragging');
            this._eElement.classList.remove('lm_dragging');
            this._oDocument.querySelector('iframe')?.style.setProperty('pointer-events', '');
            this._eElement.removeEventListener('mousemove', this._mouseMoveEventListener);
            this._eElement.removeEventListener('touchmove', this._touchMoveEventListener);
            this._oDocument.removeEventListener('mouseup', this._mouseUpEventListener);
            this._oDocument.removeEventListener('touchend', this._touchEndEventListener);
    
            if (this._bDragging === true) {
                this._bDragging = false;
                this.emit('dragStop', dragEvent);
            }
        }
    }

    private startDrag() {
        this._bDragging = true;
        this._eBody.classList.add('lm_dragging');
        this._eElement.classList.add('lm_dragging');
        this._oDocument.querySelector('iframe')?.style.setProperty('pointer-events', 'none');
        this.emit('dragStart', this._nOriginalX, this._nOriginalY);
    }

    private getMouseCoordinates(event: MouseEvent) {
        const result: DragProxy.MouseTouchCoordinates = {
            x: event.pageX,
            y: event.pageY
        };
        return result;
    }

    private getTouchCoordinates(event: TouchEvent) {
        const targetTouches = event.targetTouches;
        if (targetTouches.length === 0) {
            return undefined;
        } else {
            const targetTouch = event.targetTouches[0]
            const result: DragProxy.MouseTouchCoordinates = {
                x: targetTouch.pageX,
                y: targetTouch.pageY
            };
            return result;
        }
    }
}

export namespace DragProxy {
    export interface MouseTouchCoordinates {
        x: number,
        y: number,
    }
}