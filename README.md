# Aludel

Web application framework with components living in subjective realities.

## Installing

`npm install aludel`

## Learning

TODO: Add links to guides in the wiki

## Overview

Aludel tries to solve the Model part of Model → View relationship in most Virtual DOM inspired approaches. There is little doubt that "View is pure function of the Model" idea is working, but how exactly this Model should be implemented is up for a debate.

Main design goal for Aludel is to define a strict protocol of interaction between Components and Global State, and enforce it at runtime.

To achieve this Aludel enables you to declare which parts of global state are accessible by each Component. And then makes sure that Component Intances only see what they wanted to see by constructing a Local Model for them.

There are two ways to use this library. Component Instances and Routing can be managed manually by using Context and Router. Or you can use App and RoutedApp helpers to let Aludel take care of low level details.

See the description for Context, Router, App, and RoutedApp below.

Any Virtual DOM library should work with Aludel. It exposes a callback that will return either the latest version of Global State (if you are using Context), or the latest topmost Component Instance (if you are using the App or RoutedApp abstraction).

### Components

Components in Aludel have three stages - Template, Component, Instance. Each next stage is a more specialized version of previous one.

#### Template

Template describes _Sockets_, _Actions_, _Children_, and _Render function_. Any fields can be omitted and will be replaced by default (empty) values.

```javascript
const template = createTemplate({
    sockets: ['counter'],
    actions: {
        add: amount => model => {
            model.counter += amount
            return model
        },
    },
    children: {
        greeting: greetingComponent, // Pretend we declared this Component
    }
    render: ({ model, child }) => {
        return h('div', {}, [
            child.greeting()
            h('button', { onclick: () => action.add(-1) }, 'Decrement'),
            h('div', {}, model.counter),
            h('button', { onclick: () => action.add(1) }, 'Increment'),
        ])
    },
})
```

##### Sockets

Sockets define top fields of Local Model that will be constructed for Component Instance. In example above we have one socket `'counter'`. We don't know yet which part of Global State this socket will map to. But our Local Model, available in _Actions_ and _Render function_ will have a `'counter'` field for sure.

There is an implicit contract here in how this field is used. For example in code above we expect `'counter'` to be a number.

##### Actions

Actions define functions that update Global State. The catch is - Componets don't have access to Global State. They have access to Local Model, which is derived from Global State with the help of _Sockets_ and _Paths_ (paths will be explained later).

An action must return the new version of Local Model. This new version will get synchronized back into Global State behind the scenes, and _onUpdate_ callback will be called (usually causing the rerender).

Actions can return a Promise of Local Model. In fact every action is treated asynchronously for consistency (using `Promise.resolve()`).

Actions can also return a partial version of Local Model, by omitting some top fields. Aludel will not touch corresponding values in Global State during synchronization.

##### Children

Children object is a map of components that will be instantiated first, and passed to render function.

##### Render

Render function returns the _View_ representation of Component. With Virtual DOM libraries it's usually a bunch of virtual nodes. In example above I use [hyperdom](https://github.com/featurist/hyperdom).

Render function will recieve an object with many useful tools:

*   model - current Local Model for the Component
*   action - A map of _Connected Actions_ (see Context for meaning of _Connected_)
*   child - A map of Child Instances
*   props - An object that may have been passed from Parent Component
*   create - A function that instantiates components in the same context as current Component
*   outlet - An instance of the next Component in current Route (see Router for details)
*   navigate - A map of functions that change browser location (see Router for details)
*   link - A map of functions that return valid URL to named route (see Router for details)

#### Component

A proper Component is created by combining Template and a map of paths.

##### Paths

Paths define a path into some area of Global State for each _Socket_.

```javascript
// We reuse 'template' from previous code snippet
// Remember that we had:
//     sockets: ['counter']
const component = createComponent(template, {
    counter: ['data', 'counter'],
})
```

In example above we combine template from previous code snippet and a map of paths for each socket. Each socket must be covered by a path, otherwise Aludel will throw an error.

Let's suppose that we had a Global State looking like this:

```javascript
{
    data: {
        counter: 0
    }
}
```

The component above just defined that its `counter` socket leads to `GlobalState.data.counter`. So for each Instance of this component, Local Model will be derived from that particular place in Global State.

By default Aludel uses Lodash [get](https://lodash.com/docs#get) and [set](https://lodash.com/docs#set), so non-existing paths will be automatically created when deriving Local Model or synchronizing it back into Global State.

##### Signature

When component is created, it also calculates it's _Signature_. A signature is just a SHA-1 hash of Template plus Paths. It is used to uniquely identify Components and cache them efficiently.

##### Same Template, different Components

By varying paths we can create different components that reuse the same Template, but have a different Local Model derived from their own paths.

#### Instance

Template and Component are just data. They are configuration objects and they describe how Local Model behaves and looks like, and how to derive it. What they lack is a Context.

The code in this section is optional. If you want to manage Instances manually, it is required. If you opt in to use Aludel's App or RoutedApp, then Context and Instance management will be done automatically behind the scenes.

Component Instances are functions created by applying Component configuration to a particular Context (read more about Context in the next section).

Instances return the result of Template's render function executed in given Context.

```javascript
// We reuse 'component' from previous code snippet
const context = createContext({})
const instance = createInstance(contex, component)
instance() // returns virtual nodes from Template's render function.
```

As with Components above, different Instances can be created from the same Component by applying it to different Contexts.

### Context

#### Global State

#### Reacting to changes

### Router

#### Defining routes

##### Route component

##### Route action

##### Subroutes

#### Additional configuration

### App

### RoutedApp
