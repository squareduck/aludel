# Aludel

![Logo](https://thumbs.dreamstime.com/t/alembic-d-cartoon-illustration-70135996.jpg)

Web framework with components living in subjective realities.

## Main principles

### Declarative style

Components have three stages:
1. Component template - describes sockets, actions, and render function.
```
//
// Using mithril.js as renderer (but can be any Virtual Dom library)
//
const template = {
    sockets: ['name'],
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
2. Component - In addition to template contains "paths" (which is a lense into global model) for each socket, and optional name.
```
const component = {
    template: template,
    paths: {
      name: ['currentUser', 'name']
    }
}
```
3. Component instance - a function that returns "renderer-ready" value. This step is done by Aludel automatically when needed.

### Immutable global state

There is only place where state is stored. And all state is immutable (currently using seamless-immutable).

State updates are performed by component or route actions which are simple functions:
```
(currentState) => newState
```

But there is one detail. Component's view of the state is highly subjective.

### Subjective model


Components don't have access to global state. Interaction with state is defined by component's sockets and paths.


Sockets (defined at template stage) name all possible 'windows' into state.
And paths describe an exact location in global state for corresponding  socket.


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
