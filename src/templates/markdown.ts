export default `# Review: {{ range.since }} to {{ range.until }}
{% for day in days %}

## {{ day.label }}
{% for action in day.actions %}
{% if action.is_note %}
- {{ action.time }} · **{{ action.content }}** · _{{ action.project_name }}_
{% else %}
- {{ action.time }} · {{ action.content }} · _{{ action.project_name }}_{% if action.count > 1 %} ×{{ action.count }}{% endif %}

{% endif %}
{% endfor %}
{% endfor %}
`;
