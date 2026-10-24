from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("exams", "0002_questionset_presentation")]
    operations = [
        migrations.AlterField(
            model_name="questionset",
            name="presentation",
            field=models.CharField(
                max_length=16,
                choices=[("text", "Interactive text"), ("pdf", "Original PDF with answer fields"), ("legacy_pdf", "Legacy PDF")],
                default="text",
            ),
        ),
    ]
