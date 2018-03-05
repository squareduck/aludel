import m from 'mithril'
import { ComponentTemplate, ViewTools, Model } from '../../src/main'
import { app } from '../app'
import { navigationCpt } from './navigation'

const createNote = (lastId: number, name: string) => ({id: lastId + 1, name: name, text: name})

// Note list and input

const noteListTpl: ComponentTemplate = {
    sockets: ['list', 'input', 'lastId'],

    actions: () => ({
        '@init': () => (model: Model) => {
            return model
                .set('list', {1: {id: 1, name: 'Test', text: 'Test'}})
                .set('input', '')
                .set('lastId', 1)
        },

        updateInput: (value) => (model: Model) => {
            return model.set('input', value)
        },

        keyUp: (key) => (model: Model) => {
            if (key.code === 'Enter') {
                const note = createNote(model.lastId, model.input)
                return model
                    .setIn(['list', note.id], note)
                    .set('input', '')
                    .set('lastId', note.id)
            }
            return model
        }
    }),

    view: ({model, actions, navigate}) => 
        m('div', {class: 'main'}, [
            m('div', {class: 'notes-input'}, [
                m('input', {
                    value: model.input,
                    placeholder: 'Enter name for new note',
                    oninput: m.withAttr('value', actions.updateInput),
                    onkeyup: actions.keyUp
                })
            ]),
            m('div', {class: 'note-list'}, Object.keys(model.list).map(
                (id: string) => m('div', {onclick: () => navigate.Note({id}), class: 'note-item'}, model.list[id].name))
            )
        ])

}

const noteListCpt = app.createComponent(noteListTpl, {
    list: ['notes', 'list'],
    input: ['notes', 'input'],
    lastId: ['notes', 'lastId']
})

// Note page

const noteTpl: ComponentTemplate = {
    sockets: ['noteId', 'list', 'text'],
    actions: () => ({
        '@navigate': (params) => (model: Model) => {
        },
        editNote: (note) => (model: Model) => {
            return model
        },
        updateText: (text) => (model: Model) => {
            console.log(text)
            return model.set('text', text)
        }
    }),
    view: ({model, actions}) => {
        return m('div', {class: 'main'}, [
            m('div', {class: 'controls'}, [
                m('button', {onclick: () => actions.editNote, class: 'control'}, 'Save')
            ]),
            m('textarea', {
                value: model.text,
                class: 'note-text',
                oninput: m.withAttr('value', actions.updateText)
            })
        ])
    }
}

export const noteCpt = app.createComponent(noteTpl, {
    noteId: ['router', 'pages', 'Note', 'id'],
    list: ['notes', 'list'],
    text: ['notes', 'editor', 'text']
})

// Notes page

export const notesTpl: ComponentTemplate = {
    sockets: ['selectedNote', 'currentPage'],

    actions: () => ({}),

    view: ({model, actions, navigate}) => {
        return m('div', {class: 'notes'}, [
            navigationCpt(),
            noteListCpt()
        ])

    }
}

export const notesCpt = app.createComponent(notesTpl, {
    selectedNote: ['router', 'pages', 'Note', 'id'],
    currentPage: ['router', 'current']
})
