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

Context connects components to Global State. It creates _Connected Actions_ from _Actions_, manages caching of Component Instances and Render function results. It also exposes a callback function that will be called every time a _Connected Action_ is finished.

```javascript
const initialState = {
    data: {
        counter: 0,
    },
}
const context = createContext(initialState, state => {
    // Will be called after any Connected Action.
})
```

Context is a glue that creates dynamic behavior (Instances) from static configuration (Templates and Components)

### Router

Routing management in Aludel is optional. If you want to use it, just create a _Router_ on the same Context that is used for your Components.

```javascript
const context = createContext({})
const config = {
    routes: {
        '/': {
            name: 'Home',
            component: homeComponent,
        },
    },
}
const router = createRouter(context, config)
router.start()
```

Creating router results in a Router object with useful fields:

*   navigate - A map of functions that puts Route URL in the browser location
*   link - A map of functions that return a string URL to named Route
*   setRoute - A map of actions that set $app.route and $app.instance fields in Global State
*   start - A function that starts browser history tracking

#### Defining routes

Routes are described by a tree of objects. Let's look at example first:

```javascript
const routes = {
    '*': '/',
    '/profile': '/settings/profile',
    '/': {
        name: 'Home',
        component: homeComponent,
    },
    '/settings': {
        name: 'Settings'
        component: settingsComponent,
        subroutes: {
            '/profile': {
                name: 'ProfileSettings',
                component: profileComponent,
            },
        }
    },
    '/users/:id': {
        name: 'User',
        component: userComponent,
        action: (params) => (model) => {
            model.currentUserId = params.id
        }
    }
}
```

Above we describe how components map onto different URLs, and optionally execute an action when Route is visited.

If route value is a string, it is handled as a redirect. We also have a special `*` route called "Wildcard route" to handle all unspecified routes.

Each non-redirect route must have a name. This name will be used in creation of routing related functions in `navigate`, `link` and `setRoute`.

##### Route component

In addition to name, each non-redirect route must have a `component` key. The Component in that field will be instantiated and passed as `outlet` to the Instance of parent route Component.

##### Route action

Optionally, you can specify an `action` field. It specifies an Action in the same way that you would do it in Template, but only one Action is allowed.

This Action will execute as if it was part of route's Component. It will have the same Local Model. The argument of the outer function will be an object containing all named parameters of the route.

Route Action will always execute before Component's own actions.

##### Subroutes

Optionally, you can specify `subroutes` field. It describes nested subroutes (see example above). When Router is created, routing tree gets flattened, so all nested subroutes collapse into full URLs. And all Components and Actions are flattened into chains.

#### Additional configuration

Router configuration also takes in:

*   mountPoint - a prefix to all route URLs.
*   layoutComponent - a Component to be placed at the front of all Component chains.

#### Starting router

Created Router exposes a `start()` function. If executed, it starts listening to browser location events, and trigers `setRoute()` for matched route.

### App

### RoutedApp
