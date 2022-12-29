# `slide-grid`

`slide-grid` is a hybrid React/DOM component that supports lightweight, touch-aware reordering of children.

## Options

Using direct children supports both mouse and touch interaction. You can have a more complex hierarchy by specifying `keys`, and this will work fine on the desktop. Unfortunately, due to limitations of the HTML/browser touch event API and how React maipulates the DOM, any "reparenting" of elements (even if they maintain the same `id`/`key`) breaks the begin-move-end sequence of touch events.
