from flask import Flask, render_template, jsonify, request
import json
import os

app = Flask(__name__)
DATA_FILE = os.path.join(os.path.dirname(__file__), 'data', 'workouts.json')


def load_data():
    if not os.path.exists(DATA_FILE):
        return {"strength": [], "running": [], "journal": []}
    with open(DATA_FILE) as f:
        return json.load(f)


def save_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/workouts', methods=['GET'])
def get_workouts():
    return jsonify(load_data())


@app.route('/api/workouts/<workout_type>/<entry_id>', methods=['DELETE'])
def delete_entry(workout_type, entry_id):
    data = load_data()
    if workout_type not in data:
        return jsonify({'error': 'Invalid type'}), 400
    data[workout_type] = [e for e in data[workout_type] if e['id'] != entry_id]
    save_data(data)
    return '', 204


if __name__ == '__main__':
    app.run(debug=True, port=5050)
