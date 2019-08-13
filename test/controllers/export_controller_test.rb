require 'test_helper'

class ExportControllerTest < ActionDispatch::IntegrationTest
  setup do
    @course = create :course
    @students = [create(:student), create(:student), create(:student)]
    @course.enrolled_members.concat(@students)
    @series = create :series,
                     :with_submissions,
                     exercise_submission_users: @students,
                     course: @course,
                     deadline: Time.current
    # make accessing all database-objects easier, no need for querying
    @data = { course: @course, users: @students, series: @series, exercises: @series.exercises, deadline: @series.deadline }
    sign_in create(:zeus)
  end

  test 'should retrieve download solutions wizard page' do
    get export_series_path(@series)
    assert_response :success
  end

  test 'should return no-selection error' do
    post export_series_path(@series), params: { with_info: true }
    assert_response :bad_request
  end

  test 'should download only last submissions' do
    post export_series_path(@series), params: { all: true, only_last_submission: true, with_info: true }
    assert_response :success
    count = @students.map { |u| @series.exercises.map { |e| e.last_submission(u, nil, @series.course) } }.flatten.select(&:present?).count
    assert_zip response.body, with_info: true, solution_count: count, data: @data
  end

  test 'should be grouped by user' do
    post export_series_path(@series), params: { all: true, group_by: 'user' }
    assert_response :success
    assert_zip response.body, group_by: 'user', data: @data
  end

  test 'should be grouped by exercise' do
    post export_series_path(@series), params: { all: true, group_by: 'exercise' }
    assert_response :success
    assert_zip response.body, group_by: 'exercise', data: @data
  end

  test 'should be invalid grouping option' do
    post export_series_path(@series), params: { group_by: 'hupseflupse', all: true }
    assert_response :bad_request
  end

  test 'should retrieve all submissions' do
    post export_series_path(@series), params: { all: true }
    assert_response :success
    assert_zip response.body, solution_count: Submission.all.count, data: @data
  end

  test 'all students should be present in the zip' do
    @new_student = create(:student)
    @course.enrolled_members.concat([@new_student])
    @data[:users].concat([@new_student])
    zip_submission_count = @data[:users].map do |u|
      @data[:exercises].map do |ex|
        subs = ex.submissions.of_user(u).in_course(@series.course)
        subs = [1] if subs.empty?
        subs
      end
    end .flatten.length

    post export_series_path(@series), params: { all: true, all_students: true }
    assert_response :success
    assert_zip response.body, solution_count: zip_submission_count, data: @data
  end

  test 'zip should only contain submissions before deadline' do
    @series.update(deadline: 1.year.ago)
    post export_series_path(@series), params: { all: true, deadline: true }
    assert_response :success
    zip_submission_count = @series.exercises.map { |ex| ex.submissions.before_deadline(@series.deadline) }.flatten.length
    assert_zip response.body, solution_count: zip_submission_count, data: @data

    @series.update(deadline: Time.current + 2.years)
    post export_series_path(@series), params: { all: true, deadline: true }
    assert_response :success
    zip_submission_count = @series.exercises.map { |ex| ex.submissions.before_deadline(@series.deadline) }.flatten.length
    assert_zip response.body, solution_count: zip_submission_count, data: @data
  end

  test 'should only download from specific exercises' do
    sample_exercises = @series.exercises.sample(3)
    post export_series_path(@series), params: { selected_ids: sample_exercises.map(&:id), all_students: true }
    zip_submission_count = @data[:users].map do |u|
      sample_exercises.map do |ex|
        subs = ex.submissions.of_user(u).in_course(@series.course)
        subs = [1] if subs.empty?
        subs
      end
    end .flatten.length
    assert_zip response.body, solution_count: zip_submission_count, data: @data
  end

  test 'all options should be able to be used simultaneously' do
    @series.update(deadline: Time.current)
    sample_exercises = @series.exercises.sample(3)
    options = { selected_ids: sample_exercises.map(&:id),
                all_students: true,
                only_last_submission: true,
                deadline: @series.deadline,
                course: @series.course,
                with_info: true,
                group_by: 'exercise',
                data: @data }
    options[:solution_count] = @data[:users].map do |u|
      sample_exercises.map do |ex|
        ex.submissions.of_user(u).in_course(@series.course).before_deadline(@series.deadline).limit(1).first
      end
    end .flatten.length
    post export_series_path(@series), params: options
    assert_zip response.body, options
  end

  test 'should download all submissions from course' do
    create :series, :with_submissions, course: @course, exercise_submission_users: @students
    options = {
      only_last_submission: false,
      data: @data,
      solution_count: Submission.all.in_course(@course).count,
      all: true
    }
    post export_course_path(@course), params: options
    assert_response :success
    options[:group_by] = 'series'
    assert_zip response.body, options
  end

  test 'should download one submission per exercise from each series from course' do
    options = {
      only_last_submission: true,
      deadline: true,
      group_by: 'user',
      all_students: 'true',
      with_info: true,
      data: @data,
      all: true,
      solution_count: @course.users.count * @course.series.map(&:exercises).flatten.count
    }
    post export_course_path(@course), params: options
    assert_response :success
    options[:group_by] = 'series'
    assert_zip response.body, options
  end

  test 'should download all existing submissions from course and include all students in zip' do
    options = {
      group_by: 'exercise',
      all_students: 'true',
      data: @data,
      all: true
    }
    options[:solution_count] = @course.series.map do |series|
      @course.users.map do |user|
        series.exercises.map do |exercise|
          [exercise.submissions.of_user(user).in_course(@course).count, 1].max
        end .sum
      end .sum
    end .sum
    post export_course_path(@course), params: options
    options[:group_by] = 'series'
    assert_zip response.body, options
  end

  test 'should download all submissions of the user' do
    student = @students[0]
    options = {
      data: @data,
      all: true,
      solution_count: Submission.all.of_user(student).count
    }
    @data[:user] = student
    post export_user_path(student), params: options
    options[:group_by] = 'course'
    assert_zip response.body, options
  end

  test 'should not be able to download submissions of other user' do
    sign_in @students[2]
    other_student = @students[1]
    options = {
      data: @data,
      all: true,
      solution_count: Submission.all.of_user(other_student).count
    }
    post export_user_path(other_student), params: options
    assert_response :redirect

    sign_in create(:staff, administrating_courses: [@course])
    post export_user_path(other_student), params: options
    assert_response :redirect
  end
end
