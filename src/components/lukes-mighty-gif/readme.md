# lukes-mighty-gif



<!-- Auto Generated Below -->


## Properties

| Property       | Attribute       | Description                                                                                         | Type      | Default     |
| -------------- | --------------- | --------------------------------------------------------------------------------------------------- | --------- | ----------- |
| `controls`     | `controls`      | Whether or not to show the controls. Defaults to true.                                              | `boolean` | `true`      |
| `currentTime`  | `current-time`  | The current time in milliseconds. Defaults to 0. Setting this value will seek to the provided time. | `number`  | `0`         |
| `duration`     | `duration`      | The duration of the gif. Defaults to 0. Read-only.                                                  | `number`  | `0`         |
| `height`       | `height`        | The height of the gif. Defaults to 0. Read-only.                                                    | `number`  | `0`         |
| `paused`       | `paused`        | Whether or not the gif is paused. Defaults to true.                                                 | `boolean` | `true`      |
| `playbackRate` | `playback-rate` | How fast the gif should play in multiples of the base speed. Defaults to 1.                         | `number`  | `1`         |
| `src`          | `src`           |                                                                                                     | `string`  | `undefined` |
| `width`        | `width`         | The width of the gif. Defaults to 0. Read-only.                                                     | `number`  | `0`         |


## Events

| Event            | Description | Type                 |
| ---------------- | ----------- | -------------------- |
| `canplay`        |             | `CustomEvent<any>`   |
| `canplaythrough` |             | `CustomEvent<any>`   |
| `durationchange` |             | `CustomEvent<any>`   |
| `error`          |             | `CustomEvent<Error>` |
| `load`           |             | `CustomEvent<any>`   |
| `loadedmetadata` |             | `CustomEvent<any>`   |
| `loadstart`      |             | `CustomEvent<any>`   |
| `pause`          |             | `CustomEvent<any>`   |
| `play`           |             | `CustomEvent<any>`   |
| `progress`       |             | `CustomEvent<any>`   |
| `seeked`         |             | `CustomEvent<any>`   |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
