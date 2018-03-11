# Aludel

![Logo](https://thumbs.dreamstime.com/t/alembic-d-cartoon-illustration-70135996.jpg)

Web framework with components living in subjective realities.

## Main principles

Aludel aims to solve the Model part of Model -> View relationship in most
VirtualDOM inspired libraries. There is no doubt that "View is a pure
fuction of the Model" approach is working. But how exactly this Model should
be implemented is up for a debate.

Main design goal for Aludel is to define a strict protocol for reading and
updating parts of global state and enforce it across all components.

### Declarative style

Components have three stages:

1.  Component template - describes sockets, actions, and render function.

```
//
// Using mithril.js as renderer (but can be any Virtual Dom library)
//
const template = {
    sockets: ['name'],
    children: {},
    actions: {
        exclaim: () => (model) => {
            return model.set('name', model.name + '!')
        }
    },
    render: ({model, actions}) => {
        return m('h1', {onclick: actions.exclaim}, 'Hello, ' + model.name)
    }
}
```

**Sockets** are named placeholders for accessible paths into global state.
We only give them names here because later on we can create many
components from the same template. And they can have different paths.

Later on sockets and paths will determine the local model (that's the
subjective reality) that component will see. Actions and renderer will
only ever see the world through the sockets defined on the component.

**Actions** define state mutations which can be triggered at runtime. An action
is a function that takes in optional parameters and return an _Update function_
`(model: Model) => Model` or a Promise returning _Update function_. It is also
possible to pass an array of _Update functions_ if a mix of synchronous and
async model updates is needed for one action.

The model passed to _Update function_ is a local model for component. Returned
model will be synchronized with global state.

**Children** is a map of all children components that will be callable from
the renderer.

**Renderer** is a function that will recieve a "toolkit" object with lots of
useful utilities:

*   model - current local model
*   actions - a map of callable actions
*   navigate - a functino that can navigate to any named route
*   link - a function that returns a valid link to named route
*   children - a map of all children component instances
*   outlet - an instance of next component in routing path

It must return a value that is ready to be rendered by your VirtualDOM library

2.  Component - In addition to template contains "paths" (which is a lense
into global model) for each socket, and optional name.

```
const component = {
    name: 'MyComponent', // only used in debugging info
    template: template,
    paths: {
      name: ['currentUser', 'name']
    }
}
```

3.  Component instance - a function that returns "renderer-ready" value. This step is done by Aludel automatically when needed.

### Immutable global state

There is only place where state is stored. And all state is immutable (currently using seamless-immutable).

State updates are performed by component or route actions which are simple functions:

```
(currentState) => newState
```

But there is one caveat. Component's view of the state is highly subjective.

### Subjective model

Components don't have access to global state. Interaction with state is defined by component's sockets and paths.

Sockets (defined at template stage) name all possible 'windows' into state.
And paths describe an exact location in global state for corresponding socket.

A combination of all sockets and their paths define a local model for each component.
This model is derived from global state, and any modifications to it (during actions) will be synchronized back into global state.

### Routing

Routing in Aludel is optional. Routing is defined by a single object where keys are routing paths.

Route action will be performed before component is rendered. It has the same local model as route component.

```
const routes = {
    '/': '/home',
    '/home': {
        component: homeComponent,
        action: (params) => (model) => model
        subroutes: {
            '/:userId': {
                component: userComponent,
                action: ({userId}) => (model) => model.set('currentUser', userId)
            }
        }
    }
}
```

This object is passed to start function.

```
const app = createApp(renderer, initialModel)
app.start(document.body, topComponent, routes)
```

If current route has subroutes, component's render function will
have access to subroute component instance through 'outlet' function.
Just invoking it should return a "renderer-ready" value.

Navigation is available through "navigate('Route name', {route: 'params'})" function.

```
const template = {
    render: ({outlet, navigate}) => {
        return m('div', [
            m('h1', 'Subcomponent below'),
            m('button', {onclick: navigate('Home', {message: 'hello'})}),
            outlet()
        ])
    }
}
```

### Bring your own renderer

In theory any virtual dom library can be used with Aludel.
You have to define a renderer function which takes a DOM element
and a component instance, and knows how to render it.
This renderer function will be invoked on each global state update.

## Special thanks

To Elm language and Meiosis pattern.
