FROM python:3.10

# Set up a working directory
WORKDIR /code

# Copy requirements and install them
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy all your python files into the container
COPY . /code

# Hugging Face exposes port 7860, so we tell FastAPI to run on that port
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]